/**
 * MTProto Bridge — Hybrid Manager/User Pod
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';

// Import refactored modules
import { MODE, PORT, TARGET_USER_ID, TG_SESSION, redis } from './src/config.js';
import { auth, checkConnect, createClient } from './src/utils.js';
import { initK8s, spawnPod, deletePods, listPods, runReconciliation } from './src/k8s.js';
import { startUserClient, startAccessChecker, getUserClient } from './src/user.js';
import { sendCode, verifyCode, verifyPassword, qrStart, qrCheck } from './src/auth.js';

dns.setDefaultResultOrder('ipv4first');

const app = express();
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json());

// Initialize Kubernetes Client if Manager
initK8s();

// ─── Shared Routes ──────────────────────────────────────────────────────────

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

// ─── Redis Proxy Routes ──────────────────────────────────────────────────────

app.get('/kv/:key', auth, async (req, res) => {
    try {
        const val = await redis.get(req.params.key);
        if (val === null) return res.status(404).send('Not found');
        res.send(val);
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/kv/:key', auth, async (req, res) => {
    try {
        const val = typeof req.body.value === 'string' ? req.body.value : JSON.stringify(req.body.value);
        await redis.set(req.params.key, val);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/kv/:key', auth, async (req, res) => {
    try {
        await redis.del(req.params.key);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
});

// ─── Telegram Auth Routes (Manager) ────────────────────────────────────────

app.post('/send-code', auth, sendCode);
app.post('/verify-code', auth, verifyCode);
app.post('/verify-password', auth, verifyPassword);
app.post('/qr-start', auth, qrStart);
app.get('/qr-check', auth, qrCheck);

// ─── Diagnostics Routes ────────────────────────────────────────────────────

app.post('/test-tg', auth, async (req, res) => {
    const start = Date.now();
    try {
        const sessionToUse = req.body.session || TG_SESSION;
        if (!sessionToUse) return res.status(400).json({ success: false, error: 'No TG_SESSION' });
        
        console.log(`[/test-tg] Starting test...`);
        const client = createClient(sessionToUse, { connectionRetries: 1, onlyThis: true });
        await client.connect();
        
        if (!client.connected) return res.status(401).json({ success: false, error: 'Session expired' });
        
        const toMe = await client.getMe();
        const msgText = req.body.message || 'Test from bridge!';
        await client.sendMessage(toMe.id, { message: msgText });
        
        await Promise.race([ client.disconnect(), new Promise(resolve => setTimeout(resolve, 2000)) ]);
        
        const duration = Date.now() - start;
        return res.json({ success: true, duration });
    } catch (e) {
        const isExpired = e.message?.includes('CONNECTION_LAYER_INVALID') || e.message?.includes('SESSION');
        return res.status(isExpired ? 401 : 500).json({ success: false, error: isExpired ? 'Session expired' : e.message });
    }
});

app.post('/test-voice', auth, async (req, res) => {
    try {
        const sessionToUse = req.body.session || TG_SESSION;
        if (!sessionToUse) return res.status(400).json({ success: false, error: 'No TG_SESSION' });
        
        const client = createClient(sessionToUse, { connectionRetries: 3, onlyThis: true });
        await client.connect();
        if (!client.connected) return res.status(401).json({ success: false, error: 'Session expired' });
        
        const toMe = await client.getMe();
        await client.sendMessage(toMe.id, { message: '🔊 Voice test' });
        await client.disconnect();
        return res.json({ success: true });
    } catch (e) {
        const isExpired = e.message?.includes('CONNECTION_LAYER_INVALID') || e.message?.includes('SESSION');
        return res.status(isExpired ? 401 : 500).json({ success: false, error: isExpired ? 'Session expired' : e.message });
    }
});

// ─── K8s Pod Orchestration Routes ──────────────────────────────────────────

app.post('/spawn', auth, async (req, res) => {
    try {
        const podName = await spawnPod(req.body.userId, req.body.session);
        res.json({ success: true, podName });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/delete', auth, async (req, res) => {
    try {
        await deletePods(req.body.userId);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/pods', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).json({ error: 'Not manager' });
    try {
        const statuses = await listPods();
        res.json(statuses);
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/internal/access-revoked', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    try {
        await deletePods(req.body.userId);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Ollama Pull (Background) ──────────────────────────────────────────────

app.post('/ollama-pull', auth, async (req, res) => {
    const { url, model } = req.body;
    if (!url || !model) return res.status(400).json({ error: "Missing url or model" });
    
    fetch(`${url}/api/pull`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: model, stream: false })
    }).then(async r => {
        if (!r.ok) console.error(`[ollama] Pull failed with status: ${r.status}`);
        else console.log(`[ollama] Pull ${model} finished successfully!`);
    }).catch(e => console.error(`[ollama] Pull ${model} error:`, e.message));

    res.json({ success: true, message: `Download started in the background for ${model}` });
});

// ─── User Mode Routes ──────────────────────────────────────────────────────

app.get('/check-access', auth, async (req, res) => {
    if (MODE !== 'USER') return res.status(400).send('Not user mode');
    const userClient = getUserClient();
    if (!userClient) return res.json({ accessible: false, error: 'No client' });
    
    try {
        const { Api } = await import('telegram');
        await userClient.invoke(new Api.users.GetUsers({ id: [TARGET_USER_ID] }));
        res.json({ accessible: true });
    } catch (e) {
        const errMsg = e.errorMessage || e.message || '';
        const isBlocked = errMsg.includes('USER_IS_BLOCKED') || errMsg.includes('PEER_ID_INVALID');
        res.json({ accessible: false, blocked: isBlocked, error: errMsg });
    }
});

// ─── Initialization ────────────────────────────────────────────────────────

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
    app.listen(PORT, async () => {
        console.log(`[bridge] ${MODE} on ${PORT}`);
        const bridgeUrl = process.env.BRIDGE_URL || `http://localhost:${PORT}`;
        console.log(`[bridge] Public URL: ${bridgeUrl}`);
        if (MODE === 'USER') {
            await startUserClient();
            startAccessChecker();
        } else if (MODE === 'MANAGER') {
            setTimeout(runReconciliation, 5000);
            setInterval(runReconciliation, 5 * 60 * 1000);
        }
    });
}

export default app;
