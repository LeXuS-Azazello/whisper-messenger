/**
 * MTProto Bridge — Hybrid Manager/User Pod
 */

import 'dotenv/config';
import express from 'express';
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import * as k8s from '@kubernetes/client-node';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

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
const DEVICE_MODEL   = process.env.DEVICE_MODEL    || 'Desktop';
const APP_VERSION    = process.env.APP_VERSION    || '1.0.0';
const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Linux';

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

function withTimeout(promise, ms) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

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
        
        // Success!
        const user = result.user;
        const sessionStr = s.session.save();
        authSessions.delete(phone);
        console.log(`[/verify-code] SUCCESS! Welcome ${user.firstName} (ID: ${user.id})`);
        res.json({ success: true, session: sessionStr, userId: user.id.toString(), firstName: user.firstName });
    } catch (e) {
        if (e.message.includes('SESSION_PASSWORD_NEEDED')) {
            console.log(`[/verify-code] 2FA required for ${phone}`);
            return res.json({ success: false, requiresPassword: true });
        }
        console.error(`[/verify-code] Telegram error:`, e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/verify-password', auth, async (req, res) => {
    const { phone, password, token } = req.body;
    const key = phone || token; // Phone for code flow, token for QR flow
    console.log(`[/verify-password] Checking password for ${key}`);
    const s = authSessions.get(key);
    if (!s) return res.status(404).json({ error: 'Session not found' });

    try {
        const user = await s.client.signIn({ password: async () => password });
        const sessionStr = s.session.save();
        authSessions.delete(key);
        console.log(`[/verify-password] SUCCESS! Welcome ${user.firstName} (ID: ${user.id})`);
        res.json({ success: true, session: sessionStr, userId: user.id.toString(), firstName: user.firstName });
    } catch (e) {
        console.error(`[/verify-password] error:`, e);
        res.status(400).json({ error: e.message });
    }
});

app.post('/qr-start', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    const session = new StringSession('');
    const client = new TelegramClient(session, API_ID, API_HASH, { connectionRetries: 3 });
    await client.connect();
    let qrData = null;
    
    const loginPromise = client.signInUserWithQrCode(
        { apiId: API_ID, apiHash: API_HASH }, 
        {
            qrCode: async (code) => {
                const b64 = code.token.toString('base64url');
                qrData = { qrUrl: `tg://login?token=${b64}`, token: b64 };
            },
            password: async () => {
                const s = authSessions.get(qrData.token);
                if (s) s.status = 'password_needed';
                // We return an empty string here because we'll handle the actual sign-in in /verify-password
                // This will fail the current sign-in attempt, which is fine, 
                // as long as we keep the client/session for the manual password verification.
                return ""; 
            },
            onError: (err) => {
                console.error("[qr-start] Error:", err.message);
            }
        }
    );

    for (let i=0; i<10; i++) { if (qrData) break; await new Promise(r => setTimeout(r, 500)); }
    if (!qrData) return res.status(500).json({ error: 'QR timeout' });
    
    authSessions.set(qrData.token, { client, session, status: 'pending' });
    
    loginPromise.then(user => {
        const s = authSessions.get(qrData.token);
        if (s) { s.status = 'done'; s.user = user; s.sessionStr = session.save(); }
    }).catch(e => { 
        const s = authSessions.get(qrData.token);
        if (s && s.status === 'password_needed') {
            // Keep session for password verification
            return;
        }
        authSessions.delete(qrData.token); 
    });
    
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
    
    if (s.status === 'password_needed') {
        return res.json({ done: false, requiresPassword: true });
    }
    
    res.json({ done: false });
});

app.post('/test-tg', auth, async (req, res) => {
    try {
        const sessionToUse = req.body.session || TG_SESSION;
        if (!sessionToUse) {
            return res.status(400).json({ success: false, error: 'No TG_SESSION' });
        }
        const client = new TelegramClient(new StringSession(sessionToUse), API_ID, API_HASH, { connectionRetries: 3, onlyThis: true });
        await client.connect();
        if (!client.connected) {
            return res.status(401).json({ success: false, error: 'Session expired, re-login required' });
        }
        const toMe = await client.getMe();
        await client.sendMessage(toMe.id, { message: 'Test from bridge!' });
        await client.disconnect();
        return res.json({ success: true });
    } catch (e) {
        console.error('[test-tg] error:', e);
        const isExpired = e.message?.includes('CONNECTION_LAYER_INVALID') || e.message?.includes('SESSION');
        return res.status(isExpired ? 401 : 500).json({ success: false, error: isExpired ? 'Session expired, re-login required' : e.message });
    }
});

app.post('/test-voice', auth, async (req, res) => {
    try {
        const sessionToUse = req.body.session || TG_SESSION;
        if (!sessionToUse) {
            return res.status(400).json({ success: false, error: 'No TG_SESSION' });
        }
        const client = new TelegramClient(new StringSession(sessionToUse), API_ID, API_HASH, { connectionRetries: 3, onlyThis: true });
        await client.connect();
        if (!client.connected) {
            return res.status(401).json({ success: false, error: 'Session expired, re-login required' });
        }
        const toMe = await client.getMe();
        
        // Send simple text test first
        await client.sendMessage(toMe.id, { message: '🔊 Voice test' });
        
        // Try to send voice using built-in sample URL
        try {
            const voiceUrl = 'https://upload.wikimedia.org/wikipedia/commons/7/75/Example.ogg';
            const voiceRes = await fetch(voiceUrl);
            if (!voiceRes.ok) throw new Error(`HTTP ${voiceRes.status}`);
            const voiceBuffer = await voiceRes.arrayBuffer();

            const inputFile = await client.uploadFile(Buffer.from(voiceBuffer), {
                mimeType: 'audio/ogg',
                fileName: 'test.ogg'
            });

            await client.sendMessage(toMe.id, {
                file: inputFile,
                attributes: [new Api.DocumentAttributeAudio({ voice: true, duration: 2, title: '' })]
            });
        } catch (voiceErr) {
            console.log('[test-voice] voice send skipped:', voiceErr.message);
        }

        await client.disconnect();
        return res.json({ success: true });
    } catch (e) {
        console.error('[test-voice] error:', e);
        const isExpired = e.message?.includes('CONNECTION_LAYER_INVALID') || e.message?.includes('SESSION');
        return res.status(isExpired ? 401 : 500).json({ success: false, error: isExpired ? 'Session expired, re-login required' : e.message });
    }
});

app.post('/spawn', auth, async (req, res) => {
    const { userId, session } = req.body;
    const safeUserId = String(userId);
    // Kubernetes names must be lowercase alphanumeric or '-', and starts/ends with alphanumeric.
    const sanitizedId = safeUserId.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const namespace = process.env.POD_NAMESPACE || 'debugging-whispermsg';

    console.log(`[/spawn] Spawning pod for user ${safeUserId}`);

    try {
        // Find and delete any existing pods for this user (with timeout)
        try {
            const existing = await withTimeout(k8sApi.listNamespacedPod(
                namespace,
                undefined, undefined, undefined, undefined,
                `userId=${safeUserId}`
            ), 3000);
            
            const items = existing?.body?.items || existing?.items || [];
            if (items.length > 0) {
                console.log(`[/spawn] Found ${items.length} existing pods for ${safeUserId}, deleting...`);
                for (const p of items) {
                    if (!p?.metadata?.name) {
                        console.warn(`[/spawn] Skipping pod without metadata:`, p);
                        continue;
                    }
                    await withTimeout(k8sApi.deleteNamespacedPod(p.metadata.name, namespace), 2000).catch(e => console.error(`[/spawn] Failed to delete ${p.metadata.name}:`, e.message));
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
                        { name: 'WHISPER_SECRET', value: process.env.WHISPER_SECRET || '' },
                        { name: 'DEVICE_MODEL', value: process.env.DEVICE_MODEL || DEVICE_MODEL },
                        { name: 'APP_VERSION', value: process.env.APP_VERSION || APP_VERSION },
                        { name: 'SYSTEM_VERSION', value: process.env.SYSTEM_VERSION || SYSTEM_VERSION }
                    ],
                    resources: { requests: { memory: '512Mi' }, limits: { memory: '1Gi' } }
                }]
            }
        };

        console.log(`[/spawn] Creating new pod ${podName}`);
        await withTimeout(k8sApi.createNamespacedPod(namespace, podManifest), 5000); 

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
        const existing = await withTimeout(k8sApi.listNamespacedPod(
            namespace,
            undefined, undefined, undefined, undefined,
            `userId=${safeUserId}`
        ), 3000);
        
        const items = existing?.body?.items || existing?.items || [];
        if (items.length > 0) {
            for (const p of items) {
                if (!p?.metadata?.name) continue;
        await withTimeout(k8sApi.deleteNamespacedPod(p.metadata.name, namespace), 2000).catch((err) => {
                    console.error(`[/delete] Failed to delete pod ${p.metadata.name}:`, err.message);
                });
            }
        }
        res.json({ success: true });
    }
    catch (e) { 
        console.error(`[/delete] K8s error:`, e.body || e);
        res.status(500).json({ error: e.message }); 
    }
});

app.post('/internal/access-revoked', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
    const { userId } = req.body;
    console.log(`[/internal/access-revoked] User ${userId} removed access`);
    try {
        const safeUserId = String(userId);
        const namespace = process.env.POD_NAMESPACE || 'debugging-whispermsg';
        
        const existing = await withTimeout(k8sApi.listNamespacedPod(
            namespace,
            undefined, undefined, undefined, undefined,
            `userId=${safeUserId}`
        ), 3000);
        
        const items = existing?.body?.items || existing?.items || [];
        for (const p of items) {
            if (!p?.metadata?.name) continue;
            await withTimeout(k8sApi.deleteNamespacedPod(p.metadata.name, namespace), 2000).catch(() => {});
        }
        console.log(`[/internal/access-revoked] Deleted pod for ${userId}`);
        res.json({ success: true });
    } catch (e) {
        console.error(`[/internal/access-revoked] Error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

app.post('/send', auth, async (req, res) => {
    if (MODE !== 'USER') return res.status(400).json({ error: 'Not user mode' });
    const { chatId, text } = req.body;
    if (!chatId || !text) return res.status(400).json({ error: 'Missing chatId or text' });
    try {
        await userClient.sendMessage(chatId, { message: text });
        res.json({ success: true });
    } catch (e) {
        console.error(`[/send] Error:`, e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/pods', auth, async (req, res) => {
    if (MODE !== 'MANAGER') return res.status(400).json({ error: 'Not manager' });
    try {
        const namespace = process.env.POD_NAMESPACE || 'debugging-whispermsg';
        console.log(`[/pods] Fetching pods in namespace ${namespace}`);
        const pods = await k8sApi.listNamespacedPod(
            namespace,
            undefined, undefined, undefined, undefined,
            'app=tg-user-bridge'
        );
        const items = pods?.body?.items || pods?.items || [];
        const podStatuses = items.map(p => ({
            userId: p.metadata.labels.userId,
            status: p.status.phase,
            startTime: p.status.startTime,
            podName: p.metadata.name
        }));
        res.json(podStatuses);
    } catch (e) {
        console.error(`[/pods] Error:`, e.body || e.message);
        res.status(500).json({ error: e.message });
    }
});

// ─── USER MODE Logic ─────────────────────────────────────────────────────────
function splitLongText(text, maxLength = 4000) {
    const parts = [];
    for (let i = 0; i < text.length; i += maxLength) {
        parts.push(text.slice(i, i + maxLength));
    }
    return parts;
}

let userClient = null;
let transcribe = null;

async function handleNewMessage(event) {
    const msg = event.message;
    if (!msg || !msg.isPrivate) {
        if (msg && !msg.isPrivate) console.log(`[user] Ignoring message in non-private chat ${msg.chatId}.`);
        return;
    }
    console.log(`[user] New private message from ${msg.chatId}: ${msg.message?.slice(0, 50)}...`);

    // In GramJS, media is inside msg.media
    const mediaDoc = msg.media && msg.media.document;
    const isVoice = mediaDoc && mediaDoc.attributes.some(a => a instanceof Api.DocumentAttributeAudio && a.voice);
    const isVideoNote = mediaDoc && mediaDoc.attributes.some(a => a instanceof Api.DocumentAttributeVideo && a.roundMessage);

    if (!isVoice && !isVideoNote && !msg.videoNote && !msg.voice) {
        console.log(`[user] No supported media found (voice or video note).`);
        return;
    }

    console.log(`[user] Supported media found, starting transcription...`);

    try {
        const senderId = msg.senderId;
        const targetPeer = TARGET_USER_ID;

        // Set typing status and send notification
        await userClient.invoke(new Api.messages.SetTyping({
            peer: targetPeer,
            action: new Api.SendMessageRecordAudioAction()
        })).catch(() => {});

        const statusMsg = await userClient.sendMessage(targetPeer, {
            message: "⏳ Transcribing..." ,
            replyTo: msg.senderId

        });

        const buffer = await userClient.downloadMedia(msg.media, { workers: 1 });
        const mimeType = isVoice ? 'audio/ogg' : 'video/mp4';

        const { text, duration } = await transcribe(Buffer.from(buffer), mimeType);
        
        if (text) {
            const timeStr = typeof duration === 'number' ? duration.toFixed(1) : duration;
            const finalText = `📝 ${text}\n\n⏱ ${timeStr}s`;
            const chunks = splitLongText(finalText);
            
            for (const chunk of chunks) {
                await userClient.sendMessage(targetPeer, { 
                    message: chunk, 
                    replyTo: msg.senderId
                });
            }
        }
        
        // Remove status message
        await statusMsg.delete().catch(() => {});
        
        if (text && WORKER_URL) {
            await fetch(`${WORKER_URL}/internal/stats`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET })
            }).catch(e => console.error('[user] Stats notify failed:', e));
        }
    } catch (e) { 
        console.error('[user] Error:', e); 
    }
}

async function startUserClient() {
    if (!TG_SESSION) return console.error('[user] No TG_SESSION provided!');
    userClient = new TelegramClient(new StringSession(TG_SESSION), API_ID, API_HASH, { connectionRetries: 5 });
    await userClient.connect();

    // Import transcribe only in USER mode
    if (!transcribe) {
        const { transcribe: transcribeFunc } = await import('./transcribe.js');
        transcribe = transcribeFunc;
    }

    userClient.addEventHandler(handleNewMessage, new (require('telegram/events/index.js').NewMessage)({ incoming: true, outgoing: false }));
    console.log(`[user] Online.`);
}

app.get('/check-access', auth, async (req, res) => {
    if (MODE !== 'USER') return res.status(400).send('Not user mode');
    if (!userClient) return res.json({ accessible: false, error: 'No client' });
    
    try {
        await userClient.invoke(new Api.users.GetUsers({
            id: [TARGET_USER_ID]
        }));
        res.json({ accessible: true });
    } catch (e) {
        const errMsg = e.errorMessage || e.message || '';
        const isBlocked = errMsg.includes('USER_IS_BLOCKED') || 
                         errMsg.includes('PEER_ID_INVALID') || 
                         errMsg.includes('INPUT_USER_DEACTIVATED') ||
                         errMsg.includes('USER_ID_INVALID');
        console.log(`[/check-access] Not accessible: ${errMsg}`);
        res.json({ accessible: false, blocked: isBlocked, error: errMsg });
    }
});

let accessCheckInterval = null;
function startAccessChecker() {
    if (MODE !== 'USER' || !WORKER_URL) return;
    
    accessCheckInterval = setInterval(async () => {
        if (!userClient) return;
        try {
            await userClient.invoke(new Api.users.GetUsers({
                id: [TARGET_USER_ID]
            }));
        } catch (e) {
            const errMsg = e.errorMessage || e.message || '';
            const isBlocked = errMsg.includes('USER_IS_BLOCKED') || 
                             errMsg.includes('PEER_ID_INVALID') || 
                             errMsg.includes('INPUT_USER_DEACTIVATED') ||
                             errMsg.includes('USER_ID_INVALID');
            if (isBlocked) {
                console.log(`[access-check] User removed access: ${errMsg}, notifying manager`);
                fetch(`${WORKER_URL}/internal/access-revoked`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET })
                }).catch(() => {});
            }
        }
    }, 60000);
}

// Simple workaround for require.main === module in ESM
const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));

if (isMain) {
    app.listen(PORT, async () => {
        console.log(`[bridge] ${MODE} on ${PORT}`);
        if (MODE === 'USER') {
            await startUserClient();
            startAccessChecker();
        } else if (MODE === 'MANAGER') {
            // Startup reconciliation: spawn pods for active users
            if (WORKER_URL) {
                try {
                    console.log(`[bridge] Starting reconciliation...`);
                    const res = await fetch(`${WORKER_URL}/internal/active-users?secret=${SECRET}`);
                    if (res.ok) {
                        const users = await res.json();
                        console.log(`[bridge] Found ${users.length} active users to reconcile`);
                        for (const user of users) {
                            try {
                                console.log(`[bridge] Spawning pod for ${user.userId}`);
                                const spawnRes = await fetch(`${process.env.BRIDGE_URL || `http://localhost:${PORT}`}/spawn`, {
                                    method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": SECRET },
                                    body: JSON.stringify(user)
                                });
                                if (!spawnRes.ok) {
                                    console.error(`[bridge] Failed to spawn for ${user.userId}: ${await spawnRes.text()}`);
                                } else {
                                    console.log(`[bridge] Spawned pod for ${user.userId}`);
                                }
                            } catch (e) {
                                console.error(`[bridge] Spawn failed for ${user.userId}: ${e.message}`);
                            }
                        }
                        console.log(`[bridge] Reconciliation complete`);
                    } else {
                        console.error(`[bridge] Failed to fetch active users: ${res.status}`);
                    }
                } catch (e) {
                    console.error(`[bridge] Startup reconciliation failed: ${e.message}`);
                }
            }
        }
    });
}

export default app;
