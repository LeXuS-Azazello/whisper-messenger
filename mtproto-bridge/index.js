/**
 * MTProto Bridge — Hybrid Manager/User Pod
 */

'use strict';

const express = require('express');
const { TelegramClient, Api } = require('telegram');
const { StringSession } = require('telegram/sessions');
const k8s = require('@kubernetes/client-node');
const { transcribe } = require('./transcribe');

const app = express();
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────────
const MODE       = process.env.MODE || 'MANAGER';
const API_ID     = parseInt(process.env.TG_API_ID  || '0', 10);
const API_HASH   = process.env.TG_API_HASH         || '';
const SECRET     = process.env.BRIDGE_SECRET       || 'changeme';
const PORT       = parseInt(process.env.PORT       || '3000', 10);
const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
const TG_SESSION     = process.env.TG_SESSION     || '';
const WORKER_URL     = process.env.WORKER_URL     || '';

// K8s Client
let k8sApi = null;
if (MODE === 'MANAGER') {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    k8sApi = kc.makeApiClient(k8s.CoreV1Api);
}

// ─── Auth Middleware ────────────────────────────────────────────────────────
function auth(req, res, next) {
    const s = req.headers['x-bridge-secret'] || req.query.secret;
    if (s !== SECRET) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

const authSessions = new Map();

// ─── Manager Routes ─────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ mode: MODE, alive: true }));

app.post('/send-code', auth, async (req, res) => {
    const { phone } = req.body;
    console.log(`[/send-code] Initiating for ${phone}`);
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 5 });
    await client.connect();
    try {
        const { phoneCodeHash } = await client.sendCode({ apiId: API_ID, apiHash: API_HASH }, phone);
        authSessions.set(phone, { client, session, phoneCodeHash });
        console.log(`[/send-code] Success for ${phone}, hash sent`);
        res.json({ success: true });
    } catch (e) { 
        console.error(`[/send-code] Error:`, e); 
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/verify-code', auth, async (req, res) => {
    const { phone, code } = req.body;
    console.log(`[/verify-code] Checking code ${code} for ${phone}`);
    const s = authSessions.get(phone);
    if (!s) {
        console.error(`[/verify-code] No session for ${phone}`);
        return res.status(404).json({ error: 'Session not found' });
    }
    try {
        const result = await s.client.invoke(new Api.auth.SignIn({
            phoneNumber: phone,
            phoneCodeHash: s.phoneCodeHash,
            phoneCode: String(code)
        }));
        const user = result.user;
        const sessionStr = s.session.save();
        authSessions.delete(phone);
        console.log(`[/verify-code] SUCCESS! Welcome ${user.firstName} (ID: ${user.id})`);
        res.json({ success: true, session: sessionStr, userId: user.id.toString(), firstName: user.firstName });
    } catch (e) {
        console.error(`[/verify-code] Telegram error:`, e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/qr-start', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3 });
    await client.connect();
    let qrData = null;
    const loginPromise = client.signInUserWithQrCode({ apiId: API_ID, apiHash: API_HASH }, {
        qrCode: async (code) => {
            const b64 = code.token.toString('base64url');
            qrData = { qrUrl: `tg://login?token=${b64}`, token: b64 };
        }
    });
    for (let i=0; i<10; i++) { if (qrData) break; await new Promise(r => setTimeout(r, 500)); }
    if (!qrData) return res.status(500).json({ error: 'QR timeout' });
    authSessions.set(qrData.token, { client, session, status: 'pending' });
    loginPromise.then(user => {
        const s = authSessions.get(qrData.token);
        if (s) { s.status = 'done'; s.user = user; s.sessionStr = session.save(); }
    }).catch(e => { authSessions.delete(qrData.token); });
    res.json(qrData);
});

app.get('/qr-check', auth, (req, res) => {
    const s = authSessions.get(req.query.token);
    if (!s) return res.json({ done: false, expired: true });
    if (s.status === 'done') {
        const resp = { done: true, session: s.sessionStr, userId: s.user.id.toString(), firstName: s.user.firstName };
        authSessions.delete(req.query.token);
        return res.json(resp);
    }
    res.json({ done: false });
});

app.post('/test-tg', auth, async (req, res) => {
    try {
        const sessionToUse = req.body.session || TG_SESSION;
        if (!sessionToUse) {
            return res.status(400).json({ success: false, error: 'No TG_SESSION configured or provided' });
        }
        const client = new TelegramClient(new StringSession(sessionToUse), API_ID, API_HASH, { connectionRetries: 3 });
        await client.connect();
        await client.sendMessage('me', { message: '🧪 Bridge test‑tg: message to self ✅' });
        await client.disconnect();
        return res.json({ success: true });
    } catch (e) {
        console.error('[test-tg] error:', e);
        return res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/spawn', auth, async (req, res) => {
    const { userId, session } = req.body;
    const safeUserId = String(userId);
    const sanitizedId = safeUserId.toLowerCase().replace(/_/g, '-');
    const namespace = process.env.POD_NAMESPACE || 'debugging-whispermsg';

    console.log(`[/spawn] Spawning pod for user ${safeUserId}`);

    try {
        // Find and delete any existing pods for this user (with timeout)
        try {
            const existing = await withTimeout(k8sApi.listNamespacedPod({
                namespace,
                labelSelector: `userId=${safeUserId}`
            }), 3000);
            
            const items = existing?.body?.items || existing?.items || [];
            if (items.length > 0) {
                console.log(`[/spawn] Found ${items.length} existing pods for ${safeUserId}, deleting...`);
                for (const p of items) {
                    await withTimeout(k8sApi.deleteNamespacedPod({
                        name: p.metadata.name,
                        namespace
                    }), 2000).catch(e => console.error(`[/spawn] Failed to delete ${p.metadata.name}:`, e.message));
                }
            }
        } catch (listErr) {
            console.warn(`[/spawn] Could not list/delete existing pods for ${safeUserId} (skipping cleanup):`, listErr.message);
        }

        const podName = `tg-user-${sanitizedId}-${Date.now().toString().slice(-6)}`;
        const podManifest = {
            metadata: { name: podName, labels: { app: 'tg-user-bridge', userId: safeUserId } },
            spec: {
                containers: [{
                    name: 'bridge',
                    image: process.env.BRIDGE_IMAGE || 'azazellosaraksh/debugging-mtproto-bridge:latest',
                    env: [
                        { name: 'MODE', value: 'USER' },
                        { name: 'TARGET_USER_ID', value: safeUserId },
                        { name: 'TG_SESSION', value: session },
                        { name: 'TG_API_ID', value: String(API_ID) },
                        { name: 'TG_API_HASH', value: API_HASH },
                        { name: 'BRIDGE_SECRET', value: SECRET },
                        { name: 'WORKER_URL', value: WORKER_URL },
                        { name: 'WHISPER_SERVER_URL', value: process.env.WHISPER_SERVER_URL || '' },
                        { name: 'WHISPER_SECRET', value: process.env.WHISPER_SECRET || '' }
                    ],
                    resources: { requests: { memory: '512Mi' }, limits: { memory: '1Gi' } }
                }]
            }
        };

        console.log(`[/spawn] Creating new pod ${podName}`);
        await withTimeout(k8sApi.createNamespacedPod({
            namespace,
            body: podManifest
        }), 5000); 

        console.log(`[/spawn] Successfully spawned ${podName}`);
        res.json({ success: true, podName }); 
    }
    catch (err) { 
        console.error(`[/spawn] Critical error:`, err.message);
        res.status(500).json({ error: err.body?.message || err.message }); 
    }
});

app.post('/delete', auth, async (req, res) => {
    try {
        const safeUserId = String(req.body.userId);
        const namespace = process.env.POD_NAMESPACE || 'debugging-whispermsg';
        
        console.log(`[/delete] Deleting pods for user ${safeUserId}`);
        const existing = await withTimeout(k8sApi.listNamespacedPod({
            namespace,
            labelSelector: `userId=${safeUserId}`
        }), 3000);
        
        const items = existing?.body?.items || existing?.items || [];
        if (items.length > 0) {
            for (const p of items) {
                await withTimeout(k8sApi.deleteNamespacedPod({
                    name: p.metadata.name,
                    namespace
                }), 2000).catch(() => {});
            }
        }
        res.json({ success: true });
    }
    catch (e) { 
        console.error(`[/delete] K8s error:`, e.body || e);
        res.status(500).json({ error: e.message }); 
    }
});

// ─── USER MODE Logic ─────────────────────────────────────────────────────────

let userClient = null;
async function handleNewMessage(event) {
    const msg = event.message;
    if (!msg || (!msg.voice && !msg.audio && !msg.videoNote && !msg.roundMessage)) return;
    try {
        const buffer = await userClient.downloadMedia(msg.media, { workers: 1 });
        const { text, duration } = await transcribe(Buffer.from(buffer), msg.voice?.mimeType || msg.videoNote?.mimeType || 'audio/ogg');
        if (text) {
            const timeStr = typeof duration === 'number' ? duration.toFixed(1) : duration;
            await userClient.sendMessage(msg.chatId, { message: `📝 ${text}\n\n⏱ ${timeStr}s`, replyTo: msg.id });
            if (WORKER_URL) {
                await fetch(`${WORKER_URL}/internal/stats`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET })
                }).catch(e => console.error('[user] Stats notify failed:', e));
            }
        }
    } catch (e) { console.error('[user] Error:', e); }
}

async function startUserClient() {
    if (!TG_SESSION) return console.error('[user] No TG_SESSION provided!');
    userClient = new TelegramClient(new StringSession(TG_SESSION), API_ID, API_HASH, { connectionRetries: 5 });
    await userClient.connect();
    userClient.addEventHandler(handleNewMessage, new (require('telegram/events').NewMessage)({}));
    console.log(`[user] Online.`);
}

app.listen(PORT, async () => {
    console.log(`[bridge] ${MODE} on ${PORT}`);
    if (MODE === 'USER') await startUserClient();
});
