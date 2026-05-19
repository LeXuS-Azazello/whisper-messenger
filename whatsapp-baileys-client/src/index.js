/**
 * WhatsApp Baileys Client — Per-user pod
 *
 * Restores Baileys session from WA_SESSION env var (base64 zip) or existing
 * /app/sessions PVC, connects to WhatsApp, listens for audio/video messages,
 * transcribes via whisper-service, and replies with the transcription.
 *
 * HTTP server on :3001 exposes /health and /test-wa for the manager.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from 'baileys';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import http from 'http';
import pino from 'pino';

const TARGET_USER_ID  = process.env.TARGET_USER_ID || 'unknown';
const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER
    || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local/v1/transcribe-base64';
const MANAGER_URL = process.env.MANAGER_URL
    || 'http://whatsapp-baileys-manager.debugging-testcrash-pub.svc.cluster.local:3002';
const SECRET      = process.env.SECRET || process.env.MANAGER_SECRET || 'changeme';
const SESSION_DIR = '/app/sessions';

const MAX_RETRIES      = 3;
const RETRY_DELAYS_MS  = [3000, 6000, 12000];

// Suppress noisy pino logs emitted internally by baileys
const silentLogger = pino({ level: 'silent' });

let sock        = null;
let isLoggedOut = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function splitChunks(text, limit = 3900) {
    if (text.length <= limit) return [text];
    const chunks = [];
    let remaining = text;
    while (remaining.length > 0) {
        chunks.push(remaining.slice(0, limit));
        remaining = remaining.slice(limit);
    }
    return chunks;
}

// ─── Session Restore ─────────────────────────────────────────────────────────

function restoreSessionFromEnv() {
    const b64 = process.env.WA_SESSION;
    if (!b64 || b64.length < 100) {
        console.log('[WA-Client] No WA_SESSION env var — using existing PVC session if present');
        return;
    }
    try {
        if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

        // If creds.json already on disk (PVC), skip env restore
        const credsPath = path.join(SESSION_DIR, 'creds.json');
        if (fs.existsSync(credsPath)) {
            console.log('[WA-Client] Session already on disk (PVC), skipping env restore');
            return;
        }

        const buf = Buffer.from(b64, 'base64');
        const zip = new AdmZip(buf);
        zip.extractAllTo(SESSION_DIR, true);
        console.log('[WA-Client] ✅ Session restored from WA_SESSION env var');
    } catch (e) {
        console.error('[WA-Client] Failed to restore session from env:', e.message);
    }
}

// ─── Manager Reporting ───────────────────────────────────────────────────────

async function reportStats() {
    try {
        await fetch(`${MANAGER_URL}/internal/stats`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET }),
            signal:  AbortSignal.timeout(10000),
        });
    } catch (e) {
        console.warn('[WA-Client] Failed to report stats:', e.message);
    }
}

async function reportAccessRevoked() {
    try {
        await fetch(`${MANAGER_URL}/internal/access-revoked`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET }),
            signal:  AbortSignal.timeout(10000),
        });
    } catch (e) {
        console.warn('[WA-Client] Failed to report access-revoked:', e.message);
    }
}

// ─── Message Queue ────────────────────────────────────────────────────────────

const queue       = [];
let   processing  = false;

async function enqueue(msg) {
    queue.push(msg);
    if (!processing) processQueue();
}

async function processQueue() {
    processing = true;
    while (queue.length > 0) {
        const msg = queue.shift();
        try {
            await processAudio(msg);
        } catch (e) {
            console.error('[WA-Client] Queue error:', e.message);
        }
        if (queue.length > 0) await sleep(1500);
    }
    processing = false;
}

// ─── Audio Processing ─────────────────────────────────────────────────────────

async function deleteMsg(jid, msgId) {
    try {
        await sock.sendMessage(jid, {
            delete: { remoteJid: jid, fromMe: true, id: msgId }
        });
    } catch (_) { /* non-critical */ }
}

async function processAudio(msg) {
    if (!sock) return;

    const jid     = msg.key.remoteJid;
    const isAudio = !!msg.message?.audioMessage;
    const isVideo = !!msg.message?.videoMessage;
    const mimeType = isAudio
        ? (msg.message.audioMessage.mimetype || 'audio/ogg')
        : (msg.message.videoMessage?.mimetype || 'video/mp4');
    const label = isAudio ? '🎤 Voice' : '📹 Video';

    console.log(`[WA-Client ${TARGET_USER_ID}] ${label} from ${jid} mime=${mimeType}`);

    // Send "transcribing…" status placeholder
    let statusMsgId = null;
    try {
        const statusMsg = await sock.sendMessage(jid, {
            text: isAudio ? '🎤 Transcribing voice message...' : '📹 Transcribing video...'
        }, { quoted: msg });
        statusMsgId = statusMsg?.key?.id;
    } catch (_) { /* non-critical */ }

    // Download media
    let buffer;
    try {
        buffer = await downloadMediaMessage(
            msg, 'buffer', {},
            { reuploadRequest: sock.updateMediaMessage }
        );
    } catch (e) {
        console.error('[WA-Client] Failed to download media:', e.message);
        if (statusMsgId) await deleteMsg(jid, statusMsgId);
        return;
    }

    // Transcribe with retries
    const base64Audio = buffer.toString('base64');
    let transcription = '';
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(WHISPER_PROVIDER, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    file_base64: base64Audio,
                    mime_type:   mimeType,
                    language:    'auto',
                }),
                signal: AbortSignal.timeout(300_000),
            });
            if (!response.ok) throw new Error(`Whisper HTTP ${response.status}`);
            const data = await response.json();
            transcription = data.text || '';
            break;
        } catch (e) {
            lastErr = e;
            console.error(`[WA-Client] Whisper attempt ${attempt}/${MAX_RETRIES}: ${e.message}`);
            if (attempt < MAX_RETRIES) await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 6000);
        }
    }

    // Delete status placeholder
    if (statusMsgId) await deleteMsg(jid, statusMsgId);

    if (!transcription.trim()) {
        console.log('[WA-Client] Empty transcription, skipping reply');
        if (lastErr) console.error('[WA-Client] Last whisper error:', lastErr.message);
        return;
    }

    console.log(`[WA-Client ${TARGET_USER_ID}] Transcribed: ${transcription.trim()}`);

    // Reply (split if long)
    const chunks = splitChunks(transcription.trim(), 3900);
    for (let i = 0; i < chunks.length; i++) {
        let text = chunks[i];
        if (chunks.length === 1) text = `🎤 ${text}`;
        else                     text = `(Part ${i + 1}/${chunks.length})\n\n${text}`;
        await sock.sendMessage(jid, { text }, { quoted: msg });
        if (i < chunks.length - 1) await sleep(1500);
    }

    await reportStats();
}

// ─── WhatsApp Connection ─────────────────────────────────────────────────────

async function connectToWhatsApp() {
    if (isLoggedOut) return;

    if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

    sock = makeWASocket({
        auth:                 state,
        printQRInTerminal:    false,
        logger:               silentLogger,
        browser:              ['VoicemsgNet', 'Chrome', '1.0.0'],
        syncFullHistory:      false,
        markOnlineOnConnect:  false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Client pods should never need a new QR — session must already exist
            console.warn('[WA-Client] ⚠️  QR code generated — session missing or expired!');
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLogout   = statusCode === DisconnectReason.loggedOut;
            console.log(`[WA-Client ${TARGET_USER_ID}] Connection closed. code=${statusCode} logout=${isLogout}`);

            if (isLogout) {
                isLoggedOut = true;
                console.log('[WA-Client] Logged out — notifying manager and exiting');
                await reportAccessRevoked();
                process.exit(0);
            } else {
                console.log('[WA-Client] Reconnecting in 5s...');
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log(`[WA-Client ${TARGET_USER_ID}] ✅ Connected to WhatsApp!`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            if (msg.message.audioMessage || msg.message.videoMessage) {
                await enqueue(msg);
            }
        }
    });
}

// ─── HTTP Server (manager probes) ────────────────────────────────────────────

function startHttpServer() {
    const server = http.createServer((req, res) => {
        const url    = req.url?.split('?')[0];
        const method = req.method;

        if (url === '/health' && method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                alive:     true,
                userId:    TARGET_USER_ID,
                connected: !!sock,
            }));
        }

        if (url === '/test-wa' && method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', async () => {
                try {
                    if (!sock) return respond(res, 503, { error: 'Not connected' });
                    const me = sock.user;
                    respond(res, 200, { success: true, me, userId: TARGET_USER_ID });
                } catch (e) {
                    respond(res, 500, { error: e.message });
                }
            });
            return;
        }

        res.writeHead(404);
        res.end('Not found');
    });

    server.listen(3001, '0.0.0.0', () => {
        console.log(`[WA-Client ${TARGET_USER_ID}] HTTP server listening on :3001`);
    });
}

function respond(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

console.log(`[WA-Client] Starting for userId=${TARGET_USER_ID}`);
restoreSessionFromEnv();
startHttpServer();
connectToWhatsApp();