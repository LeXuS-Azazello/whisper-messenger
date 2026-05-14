/**
 * MTProto Bridge — Manager-only (orchestrates tg-client PODs)
 * 
 * tg-client runs as a separate POD/process per user.
 * This process only handles auth, pod orchestration, and admin routes.
 */

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dns from 'dns';

import { MODE, PORT, TARGET_USER_ID, TG_SESSION, redis } from './src/config.js';
import { auth, checkConnect, createClient } from './src/utils.js';
import { initK8s, spawnPod, deletePods, listPods, runReconciliation } from './src/k8s.js';
import { sendCode, verifyCode, verifyPassword, qrStart, qrCheck } from './src/auth.js';

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

app.post('/send-code', auth, sendCode);
app.post('/verify-code', auth, verifyCode);
app.post('/verify-password', auth, verifyPassword);
app.post('/qr-start', auth, qrStart);
app.get('/qr-check', auth, qrCheck);

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
            try { await client.close(); } catch (e) {}
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
            try { await client.close(); } catch (e) {}
        }
    }
});

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
        const userId = req.body.userId;
        if (!userId) return res.status(400).json({ error: 'Missing userId' });

        console.log(`[/delete] Full account disconnect requested for user ${userId}`);

        // 1. Delete Pods
        await deletePods(userId);

        // 2. Delete from Redis
        await redis.del(`tg_session_${userId}`);

        // 3. Delete from local filesystem
        const dbDir = `/tmp/tdlib/${userId}`;
        if (fs.existsSync(dbDir)) {
            console.log(`[/delete] Removing session directory: ${dbDir}`);
            fs.rmSync(dbDir, { recursive: true, force: true });
        }

        res.json({ success: true });
    } catch(e) {
        console.error(`[/delete] Error:`, e.message);
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

const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
    app.listen(PORT, async () => {
        console.log(`[bridge] ${MODE} on ${PORT}`);
        const bridgeUrl = process.env.BRIDGE_URL || `http://localhost:${PORT}`;
        console.log(`[bridge] Public URL: ${bridgeUrl}`);
        if (MODE === 'MANAGER') {
            // MANAGER: orchestrates tg-client PODs via K8s
            setTimeout(runReconciliation, 3000);
            setInterval(runReconciliation, 60 * 1000); // Check every 1 minute
        }

    });
}

export default app;
