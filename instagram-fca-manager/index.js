/**
 * Instagram FCA Bridge — Manager-only (orchestrates instagram-fca-client PODs)
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';
import * as k8s from '@kubernetes/client-node';
import mongoose from 'mongoose';

import { MODE, PORT, TARGET_USER_ID, redis, MONGODB_URI, SECRET, WORKER_URL } from './src/config.js';
import { initK8s, spawnPod, deletePods, listPods, runReconciliation, resolveNamespace } from './src/k8s.js';
import { handleLogin } from './src/auth.js';
import { auth, checkConnect } from './src/utils.js';
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

app.post('/auth/login', auth, handleLogin);

app.post('/spawn', auth, async (req, res) => {
    try {
        const { userId, session, username, igId, igLogin } = req.body;
        if (session && session.length > 100) {
            await redis.set(`insta_session_${userId}`, session, 'EX', 86400 * 30);
        }
        const podName = await spawnPod(userId, session, username, igId, igLogin);
        res.json({ success: true, podName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/delete', auth, async (req, res) => {
    try {
        const userId = req.body.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        console.log(`[/delete] Full Instagram account disconnect requested for user ${userId}`);

        // 1. Delete Pods
        await deletePods(userId);

        // 2. Delete from Redis
        await redis.del(`insta_session_${userId}`);

        // 3. Update MongoDB
        await User.findOneAndUpdate({ userId: String(userId) }, {
            $unset: { instagramId: "" },
            isActive: false
        });
        await MessengerSession.findOneAndUpdate({ userId: String(userId), platform: 'instagram' }, {
            $unset: { sessionData: "" },
            isActive: false
        });

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
    const { userId } = req.body;
    try {
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        const targetUrl = WORKER_URL || 'http://echo-frontend';
        const cleanUrl = targetUrl.replace(/\/$/, '') + '/internal/stats';

        console.log(`[manager] Forwarding stats increment for ${userId} to ${cleanUrl}`);

        const response = await fetch(cleanUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: String(userId), secret: SECRET, platform: 'instagram' })
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`[manager] Failed to forward stats to frontend: ${response.status} - ${errText}`);
            // Fallback: update DB locally if frontend communication fails
            await User.findOneAndUpdate(
                { userId: String(userId) },
                {
                    $inc: { transcriptionCount: 1, instaTranscriptionCount: 1 },
                    lastActiveAt: new Date()
                },
                { upsert: true }
            );
        }

        res.json({ success: true });
    } catch (e) {
        console.error(`[manager] Error forwarding stats:`, e);
        try {
            await User.findOneAndUpdate(
                { userId: String(userId) },
                {
                    $inc: { transcriptionCount: 1, instaTranscriptionCount: 1 },
                    lastActiveAt: new Date()
                },
                { upsert: true }
            );
        } catch (dbErr) {
            console.error(`[manager] Fallback database update failed:`, dbErr);
        }
        res.json({ success: true });
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
        console.log(`[manager] Instagram FCA Manager running on ${PORT}`);
        if (MODE === 'MANAGER') {
            setTimeout(runReconciliation, 3000);
            setInterval(runReconciliation, 60 * 1000);
        }
    });
}

export default app;