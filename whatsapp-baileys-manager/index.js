/**
 * WhatsApp Baileys Bridge — Manager-only (orchestrates whatsapp-baileys-client PODs)
 * 
 * whatsapp-baileys-client runs as a separate POD/process per user.
 * This process only handles auth, pod orchestration, and admin routes.
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';

import { MODE, PORT, TARGET_USER_ID, redis, MONGODB_URI, SECRET, WORKER_URL } from './src/config.js';
import { initK8s, spawnPod, deletePods, listPods, runReconciliation } from './src/k8s.js';
import { sendCode, verifyCode, verifyPassword, qrStart, qrCheck, authSessions } from './src/auth.js';
import mongoose from 'mongoose';
import User from './src/models/User.js';
import MessengerSession from './src/models/MessengerSession.js';

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Initialize Kubernetes Client if Manager
initK8s();

// Initialize MongoDB
if (MODE === 'MANAGER') {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log(`[manager] Connected to MongoDB: ${MONGODB_URI}`))
        .catch(err => console.error(`[manager] MongoDB connection error:`, err.message));
}

app.get('/health', (req, res) => {
    res.json({ mode: MODE, alive: true, userId: TARGET_USER_ID || null });
});

app.get('/env', auth, (req, res) => res.json(process.env));

app.get('/test-net', auth, async (req, res) => {
    const host = req.query.host || 'kubernetes.default.svc';
    const port = parseInt(req.query.port || '443');
    console.log(`[/test-net] Testing ${host}:${port}`);
    const result = await checkConnect(host, port);
    res.json({ host, port, result });
});

app.get('/kv/:key', auth, async (req, res) => {
    try {
        const val = await redis.get(req.params.key);
        if (val === null) return res.status(404).send('Not found');
        res.send(val);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/kv/:key', auth, async (req, res) => {
    try {
        const val = typeof req.body.value === 'string' ? req.body.value : JSON.stringify(req.body.value);
        await redis.set(req.params.key, val);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/kv/:key', auth, async (req, res) => {
    try {
        await redis.del(req.params.key);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/auth/send-code', auth, sendCode);
app.post('/auth/verify-code', auth, verifyCode);
app.post('/auth/verify-password', auth, verifyPassword);
app.post('/auth/qr-start', auth, qrStart);
app.get('/auth/qr-check', auth, qrCheck);

app.post('/test-wa', auth, async (req, res) => {
    const start = Date.now();
    let client;
    try {
        const userId = req.body.userId || TARGET_USER_ID;
        if (!userId) return res.status(400).json({ success: false, error: 'No userId' });

        console.log(`[/test-wa] Starting WhatsApp Baileys test for ${userId}...`);

        // Check if there is already a running pod for this user
        if (MODE === 'MANAGER') {
            try {
                const runningPods = await listPods().catch(() => []);
                const userPod = runningPods.find(p => String(p.userId) === String(userId) && p.status === 'Running' && p.podIP);
                if (userPod) {
                    console.log(`[/test-wa] User ${userId} has a running pod at ${userPod.podIP}. Routing request to the pod.`);
                    const podUrl = `http://${userPod.podIP}:3001/test-wa`;
                    const podRes = await fetch(podUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: req.body.message
                        }),
                        signal: AbortSignal.timeout(10000)
                    });
                    const podData = await podRes.json().catch(() => ({ error: 'Pod bridge error' }));
                    if (podRes.ok) {
                        const duration = Date.now() - start;
                        return res.json({ success: true, duration, me: podData.me, routedToPod: true });
                    } else {
                        throw new Error(podData.error || `Pod returned error code ${podRes.status}`);
                    }
                }
            } catch (podErr) {
                console.error(`[/test-wa] Failed to contact/forward to user pod:`, podErr.message);
                return res.status(500).json({ success: false, error: `User pod communication failed: ${podErr.message}` });
            }
        }

        // For now, we'll just return success since we're not implementing the actual client test
        // In a full implementation, we would create a WhatsAppBaileysClient instance and test it
        const duration = Date.now() - start;
        return res.json({ success: true, duration, note: 'Test endpoint - actual testing requires client instance' });
    } catch (e) {
        console.error(`[/test-wa] Error:`, e.message);
        return res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) {
            console.log(`[/test-wa] Closing test client for ${req.body.userId || TARGET_USER_ID}`);
            try { await client.close(); } catch (e) { }
        }
    }
});

app.post('/spawn', auth, async (req, res) => {
    try {
        const { userId, session } = req.body;
        if (session && session.length > 100) {
            await redis.set(`wa_session_${userId}`, session, 'EX', 86400 * 30);
        }
        const podName = await spawnPod(userId, session);
        res.json({ success: true, podName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/delete', auth, async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        console.log(`[/delete] Full account disconnect requested for user ${userId}`);

        // 1. Delete Pods
        await deletePods(userId);

        // 2. Delete from Redis
        await redis.del(`wa_session_${userId}`);

        // 3. Update MongoDB
        await User.findOneAndUpdate({ userId: String(userId) }, {
            $unset: { waSession: "" },
            isActive: false
        });
        await MessengerSession.findOneAndUpdate({ userId: String(userId), platform: 'whatsapp' }, {
            $unset: { sessionData: "" },
            isActive: false
        });

        // 4. Delete from local filesystem
        const dbDir = `/tmp/whatsapp-baileys/${userId}`;
        if (fs.existsSync(dbDir)) {
            console.log(`[/delete] Removing session directory: ${dbDir}`);
            fs.rmSync(dbDir, { recursive: true, force: true });
        }

        res.json({ success: true });
    } catch (e) {
        console.error(`[/delete] Error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/pods', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).json({ error: 'Not manager' });
    try {
        const statuses = await listPods();
        res.json(statuses);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/internal/logs/:podName', auth, async (req, res) => {
    try {
        const { podName } = req.params;
        const ns = resolveNamespace();
        const kc = new k8s.KubeConfig();
        kc.loadFromDefault();
        const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
        const logRes = await k8sApi.readNamespacedPodLog({ name: podName, namespace: ns, tailLines: 200 });
        res.type('text/plain').send(logRes?.body || logRes);
    } catch (e) {
        res.status(500).send(`Error fetching logs for pod ${req.params.podName}: ${e.message}`);
    }
});

app.post('/internal/stats', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        // Forward to the main frontend web app to update the KV/Redis cache AND the database
        const targetUrl = WORKER_URL || 'http://echo-frontend';
        const cleanUrl = targetUrl.replace(/\/$/, '') + '/internal/stats';

        console.log(`[manager] Forwarding stats increment for ${userId} to ${cleanUrl}`);

        const response = await fetch(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: String(userId), secret: SECRET })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`[manager] Failed to forward stats to frontend: ${response.status} - ${errText}`);
            // Fallback: update DB locally if frontend communication fails
            await User.findOneAndUpdate(
                { userId: String(userId) },
                {
                    $inc: { transcriptionCount: 1 },
                    lastActiveAt: new Date()
                },
                { upsert: true }
            );
        }

        res.json({ success: true });
    } catch (e) {
        console.error(`[manager] Error forwarding stats:`, e);
        // Fallback: update DB locally
        try {
            await User.findOneAndUpdate(
                { userId: String(userId) },
                {
                    $inc: { transcriptionCount: 1 },
                    lastActiveAt: new Date()
                },
                { upsert: true }
            );
        } catch (dbErr) {
            console.error(`[manager] Fallback database update failed:`, dbErr);
        }
        res.json({ success: true }); // Still return success to client so it doesn't retry endlessly
    }
});

app.post('/internal/access-revoked', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    try {
        const { userId } = req.body;
        await deletePods(userId);
        await User.findOneAndUpdate({ userId: String(userId) }, { isActive: false });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
    app.listen(PORT, async () => {
        console.log(`[manager] ${MODE} on ${PORT}`);
        const managerUrl = process.env.BRIDGE_URL || `http://localhost:${PORT}`;
        console.log(`[manager] Public URL: ${managerUrl}`);
        if (MODE === 'MANAGER') {
            // MANAGER: orchestrates whatsapp-baileys-client PODs via K8s
            setTimeout(runReconciliation, 3000);
            setInterval(runReconciliation, 60 * 1000); // Check every 1 minute
        }
    });
}

export default app;