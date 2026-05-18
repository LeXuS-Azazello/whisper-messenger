/**
 * TDLib Bridge — Manager-only (orchestrates tg-client PODs)
 * 
 * tg-client runs as a separate POD/process per user.
 * This process only handles auth, pod orchestration, and admin routes.
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';

import { MODE, PORT, TARGET_USER_ID, TG_SESSION, redis, MONGODB_URI } from './src/config.js';
import { auth, checkConnect, createClient } from './src/utils.js';
import { initK8s, spawnPod, deletePods, listPods, runReconciliation } from './src/k8s.js';
import { sendCode, verifyCode, verifyPassword, qrStart, qrCheck, authSessions } from './src/auth.js';
import mongoose from 'mongoose';
import User from './src/models/User.js';

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
app.post('/auth/bot-login', auth, async (req, res) => {
    try {
        const { token, userId } = req.body;
        const tempId = userId || `bot_temp_${Date.now()}`;
        const client = createClient(tempId);
        await client.connect();
        await client.invoke({ "_": "checkAuthenticationBotToken", "token": token });

        const me = await client.invoke({ "_": "getMe" });
        const { packSession } = await import('./src/utils.js');
        const session = await packSession(tempId);

        await client.close();
        res.json({ success: true, session, userId: String(me.id), firstName: me.first_name });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

app.post('/auth/verify-email', auth, async (req, res) => {
    try {
        const { phone, email } = req.body;
        const s = authSessions.get(phone);
        if (!s) return res.status(404).json({ error: 'Session not found' });
        await s.client.invoke({ "_": "setAuthenticationEmailAddress", "email_address": email });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/auth/verify-email-code', auth, async (req, res) => {
    try {
        const { phone, code } = req.body;
        const s = authSessions.get(phone);
        if (!s) return res.status(404).json({ error: 'Session not found' });
        await s.client.invoke({ "_": "checkAuthenticationEmailCode", "code": { "_": "emailAddressAuthenticationCode", "code": code } });
        res.json({ success: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/test-tg', auth, async (req, res) => {
    const start = Date.now();
    let client;
    try {
        const userId = req.body.userId || TARGET_USER_ID;
        if (!userId) return res.status(400).json({ success: false, error: 'No userId' });

        console.log(`[/test-tg] Starting TDLib test for ${userId}...`);

        const { unpackSession } = await import('./src/utils.js');
        let sessionBase64 = req.body.session || await redis.get(`tg_session_${userId}`);

        if (sessionBase64 && sessionBase64.length > 100) {
            console.log(`[/test-tg] Restoring session (length: ${sessionBase64.length}) for ${userId}`);
            unpackSession(userId, sessionBase64);
        }

        client = createClient(userId, { connectionRetries: 1 });

        await client.connect();

        const me = await client.invoke({ "_": "getMe" });
        const msgText = req.body.message || 'Test from bridge via TDLib!';

        console.log(`[/test-tg] Sending test message to self (${me.id}) for user ${userId}`);

        await client.invoke({
            "_": "sendMessage",
            "chat_id": me.id,
            "input_message_content": {
                "_": "inputMessageText",
                "text": { "_": "formattedText", "text": msgText }
            }
        });

        const duration = Date.now() - start;
        return res.json({ success: true, duration, me });
    } catch (e) {
        console.error(`[/test-tg] Error:`, e.message);
        return res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) {
            console.log(`[/test-tg] Closing test client for ${req.body.userId || TARGET_USER_ID}`);
            try { await client.close(); } catch (e) { }
        }
    }
});

app.post('/test-voice', auth, async (req, res) => {
    let client;
    try {
        const userId = req.body.userId || TARGET_USER_ID;

        // Restore session from Redis to avoid phone prompt
        const { unpackSession } = await import('./src/utils.js');
        const sessionBase64 = await redis.get(`tg_session_${userId}`);
        if (sessionBase64) {
            console.log(`[/test-voice] Restoring session from Redis for ${userId}`);
            unpackSession(userId, sessionBase64);
        }

        client = createClient(userId, { connectionRetries: 3 });

        await client.connect();
        const me = await client.invoke({ "_": "getMe" });
        await client.invoke({
            "_": "sendMessage",
            "chat_id": me.id,
            "input_message_content": {
                "_": "inputMessageText",
                "text": { "_": "formattedText", "text": "🔊 TDLib Voice test" }
            }
        });
        return res.json({ success: true });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
    } finally {
        if (client) {
            console.log(`[/test-voice] Closing test client for ${req.body.userId || TARGET_USER_ID}`);
            try { await client.close(); } catch (e) { }
        }
    }
});

app.post('/spawn', auth, async (req, res) => {
    try {
        const podName = await spawnPod(req.body.userId, req.body.session);
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
        await redis.del(`tg_session_${userId}`);

        // 3. Update MongoDB
        await User.findOneAndUpdate({ userId: String(userId) }, {
            $unset: { tgSession: "" },
            isActive: false
        });

        // 4. Delete from local filesystem
        const dbDir = `/tmp/tdlib/${userId}`;
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
        const logRes = await k8sApi.readNamespacedPodLog(podName, ns, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 200);
        res.type('text/plain').send(logRes.body);
    } catch (e) {
        res.status(500).send(`Error fetching logs for pod ${req.params.podName}: ${e.message}`);
    }
});

app.post('/internal/stats', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        await User.findOneAndUpdate(
            { userId: String(userId) },
            {
                $inc: { transcriptionCount: 1 },
                lastActiveAt: new Date()
            },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
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
            // MANAGER: orchestrates tg-client PODs via K8s
            setTimeout(runReconciliation, 3000);
            setInterval(runReconciliation, 60 * 1000); // Check every 1 minute
        }

    });
}

export default app;
