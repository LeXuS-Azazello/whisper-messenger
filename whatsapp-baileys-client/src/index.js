/**
 * WhatsApp Baileys Client — Per-user pod
 *
 * Restores Baileys session from WA_SESSION env var (base64 zip) or existing
 * /app/sessions PVC, connects to WhatsApp, listens for audio/video messages,
 * transcribes via whisper-service, and replies with the transcription.
 *
 * HTTP server on :3001 exposes /health and /test-wa for the manager.
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage, Browsers } from 'baileys';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import http from 'http';
import pino from 'pino';
import Redis from 'ioredis';
import translate from 'google-translate-api-x';
import { isSamesameRequest, parseSamesameRequest, cloneVoiceWithSamesame } from '../shared/samesame.js';

const TARGET_USER_ID  = process.env.TARGET_USER_ID || 'unknown';
let WHISPER_PROVIDER = process.env.WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
if (WHISPER_PROVIDER === 'whisper-turbo' || WHISPER_PROVIDER === 'whisper-service-v2') {
    WHISPER_PROVIDER = 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
} else if (!WHISPER_PROVIDER.startsWith('http://') && !WHISPER_PROVIDER.startsWith('https://')) {
    WHISPER_PROVIDER = 'http://' + WHISPER_PROVIDER;
}
WHISPER_PROVIDER = WHISPER_PROVIDER.replace(/\/$/, '') + '/v1/transcribe-base64';
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
let isReconnecting = false;

// Initialize Redis Client
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
});
redis.on('error', (err) => {
    console.error('[WA-Client] Redis error:', err.message);
});

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

function getLangLabel(code) {
    if (!code) return '🌐 auto';
    const normalized = code.toLowerCase().split('_')[0];
    const map = {
        'ru': '🇷🇺 рус', 'rus': '🇷🇺 рус',
        'en': '🇺🇸 eng', 'eng': '🇺🇸 eng',
        'he': '🇮🇱 עבר', 'heb': '🇮🇱 עבר',
        'uk': '🇺🇦 укр',
        'de': '🇩🇪 нем', 'deu': '🇩🇪 нем',
        'fr': '🇫🇷 фр', 'fra': '🇫🇷 фр',
        'es': '🇪🇸 исп', 'spa': '🇪🇸 исп',
        'th': '🇹🇭 тай',
        'zh': '🇨🇳 кит', 'zho': '🇨🇳 кит',
        'ja': '🇯🇵 яп', 'jpn': '🇯🇵 яп',
        'ko': '🇰🇷 kor',
        'ar': '🇸🇦 ар', 'arb': '🇸🇦 ар',
        'vi': '🇻🇳 вьет',
        'id': '🇮🇩 инд',
        'tr': '🇹🇷 тур',
        'auto': '🌐 auto',
    };
    return map[normalized] || `🌐 ${normalized}`;
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
            console.log('[WA-Client] Session already on disk (PVC), skipping env restore to preserve newer credentials');
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
            headers: { 
                'Content-Type': 'application/json',
                'x-manager-secret': SECRET
            },
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
            headers: { 
                'Content-Type': 'application/json',
                'x-manager-secret': SECRET
            },
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
    let detectedLang = '';
    let lastErr;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(WHISPER_PROVIDER, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                    file_data:   base64Audio,
                    mime_type:   mimeType,
                    language:    'auto',
                }),
                signal: AbortSignal.timeout(300_000),
            });
            if (!response.ok) throw new Error(`Whisper HTTP ${response.status}`);
            const data = await response.json();
            transcription = data.text || '';
            detectedLang = data.language || '';
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

    let finalText = transcription.trim();
    const labelPrefix = getLangLabel(detectedLang);
    let finalLabel = labelPrefix;

    // Handle Translation
    try {
        let targetLang = await redis.get(`translate_lang_${TARGET_USER_ID}`);
        if (!targetLang) {
            try {
                const rawMeta = await redis.get(`user_meta_${TARGET_USER_ID}`);
                if (rawMeta) {
                    const meta = JSON.parse(rawMeta);
                    targetLang = meta.preferredTranslationLanguage || meta.preferred_translation_lang || null;
                }
            } catch (err) {
                console.error(`[WA-Client] Failed to read user_meta for translation:`, err.message);
            }
        }
        if (!targetLang) targetLang = 'auto';

        if (targetLang !== 'off') {
            if (targetLang === 'auto') {
                targetLang = 'en'; // Default to english for auto target
            }

            const isSameLanguage = detectedLang && targetLang 
                && (detectedLang.toLowerCase().startsWith(targetLang.toLowerCase()) 
                    || targetLang.toLowerCase().startsWith(detectedLang.toLowerCase()));
                    
            if (!isSameLanguage) {
                console.time(`[WA-Client] Translate to ${targetLang}`);
                const transResult = await translate(finalText, { to: targetLang });
                console.timeEnd(`[WA-Client] Translate to ${targetLang}`);
                
                if (transResult && transResult.text) {
                    finalText = transResult.text + `\n\n_(${labelPrefix} → ${getLangLabel(targetLang)})_\n_Orig: ${finalText}_`;
                    finalLabel = ''; // Label included in footer
                }
            }
        }
    } catch (transErr) {
        console.error(`[WA-Client] Translation error:`, transErr.message);
    }

    if (finalLabel) finalText = `${finalLabel} ${finalText}`;

    console.log(`[WA-Client ${TARGET_USER_ID}] Transcribed: ${finalText}`);

    // Reply (split if long)
    const chunks = splitChunks(finalText, 3900);
    for (let i = 0; i < chunks.length; i++) {
        let text = chunks[i];
        if (chunks.length > 1) {
            text = `(Part ${i + 1}/${chunks.length})\n\n${text}`;
        }
        await sock.sendMessage(jid, { text }, { quoted: msg });
        if (i < chunks.length - 1) await sleep(1500);
    }

    await reportStats();
}

// ─── Voice Cloning (SAMESAME) ──────────────────────────────────────────────────

async function handleSamesameReplyIfNeeded(msg) {
    if (!msg || !msg.message) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    if (!isSamesameRequest(text)) return;

    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = quotedContext?.quotedMessage;
    const quotedMsgId = quotedContext?.stanzaId;

    if (!quotedMsg) return;

    const mediaMsg = getMediaMessage(quotedMsg);
    if (!mediaMsg) {
        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Нужно ответить на голосовое сообщение или видео.' }, { quoted: msg });
        return;
    }

    const jid = msg.key.remoteJid;
    const { text: cleanText, language } = parseSamesameRequest(text);
    if (!cleanText) {
        await sock.sendMessage(jid, { text: '⚠️ После !SAMESAME! нужно написать текст, который нужно произнести.' }, { quoted: msg });
        return;
    }

    let statusMsgId = null;
    try {
        const statusMsg = await sock.sendMessage(jid, { text: '🎤 Клонирую голос... (SAMESAME)' }, { quoted: msg });
        statusMsgId = statusMsg?.key?.id;

        const mockMsg = {
            key: {
                remoteJid: jid,
                id: quotedMsgId,
                fromMe: quotedContext.participant === sock.user?.id
            },
            message: mediaMsg
        };

        const buffer = await downloadMediaMessage(
            mockMsg,
            'buffer',
            {},
            { reuploadRequest: sock.updateMediaMessage }
        );

        if (!buffer) throw new Error('Failed to download source audio');

        const mime = mediaMsg.audioMessage ? (mediaMsg.audioMessage.mimetype || 'audio/ogg') : (mediaMsg.videoMessage?.mimetype || 'video/mp4');

        const samesameUrl = process.env.SAMESAME_URL || 'http://samesame:8002';
        const samesameSecret = process.env.SAMESAME_SECRET;

        const { audioBuffer: resultBuffer } = await cloneVoiceWithSamesame({
            sourceAudioBuffer: buffer,
            text: cleanText,
            language,
            sourceMimeType: mime,
            samesameSecret,
            samesameUrl
        });

        // Send the cloned voice back as audio (voice note)
        await sock.sendMessage(jid, {
            audio: resultBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: msg });

    } catch (err) {
        console.error('[WA-Client] SAMESAME error:', err);
        await sock.sendMessage(jid, { text: `Ошибка SAMESAME: ${err.message}` }, { quoted: msg });
    } finally {
        if (statusMsgId) await deleteMsg(jid, statusMsgId);
    }
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
        browser:              Browsers.ubuntu('Chrome'),
        syncFullHistory:      false,
        markOnlineOnConnect:  false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            // Client pods should never need a new QR — session must already exist
            console.warn('[WA-Client] ⚠️  QR code generated — session missing or expired! Self-destructing...');
            isLoggedOut = true;
            try {
                if (fs.existsSync(SESSION_DIR)) {
                    fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                }
            } catch (e) {
                console.error('[WA-Client] Failed to clean up session dir:', e.message);
            }
            await reportAccessRevoked();
            process.exit(1);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const isLogout   = statusCode === DisconnectReason.loggedOut;
            console.log(`[WA-Client ${TARGET_USER_ID}] Connection closed. code=${statusCode} logout=${isLogout}`);

            if (isLogout) {
                isLoggedOut = true;
                console.log('[WA-Client] Logged out — deleting session, notifying manager and exiting');
                try {
                    if (fs.existsSync(SESSION_DIR)) {
                        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error('[WA-Client] Failed to clean up session dir:', e.message);
                }
                await reportAccessRevoked();
                process.exit(0);
            } else {
                if (!isReconnecting) {
                    isReconnecting = true;
                    console.log('[WA-Client] Reconnecting in 5s...');
                    setTimeout(() => {
                        isReconnecting = false;
                        connectToWhatsApp();
                    }, 5000);
                }
            }
        } else if (connection === 'open') {
            console.log(`[WA-Client ${TARGET_USER_ID}] ✅ Connected to WhatsApp!`);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
            if (!msg.message) continue;

            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

            // Handle /lang settings command
            if (msg.key.fromMe && text.startsWith('/lang')) {
                try {
                    const parts = text.split(/\s+/);
                    const langOpt = parts[1] ? parts[1].toLowerCase() : 'auto';
                    await redis.set(`translate_lang_${TARGET_USER_ID}`, langOpt);
                    let reply = `✅ Translation target set to: ${langOpt}`;
                    if (langOpt === 'off') reply = `✅ Translation disabled.`;
                    else if (langOpt === 'auto') reply = `✅ Translation set to auto.`;
                    await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
                } catch (err) {
                    console.error('[WA-Client] failed to set lang:', err.message);
                }
                continue;
            }

            // Handle SAMESAME request
            if (isSamesameRequest(text)) {
                handleSamesameReplyIfNeeded(msg).catch(err => {
                    console.error('[WA-Client] SAMESAME handler error:', err.message);
                });
                continue;
            }

            if (msg.key.fromMe) continue;
            
            // Strictly process only private, direct messages (JIDs ending with @s.whatsapp.net)
            if (!msg.key.remoteJid || !msg.key.remoteJid.endsWith('@s.whatsapp.net')) continue;

            const mediaMsg = getMediaMessage(msg.message);
            if (mediaMsg) {
                const clonedMsg = {
                    ...msg,
                    message: mediaMsg
                };
                await enqueue(clonedMsg);
            }
        }
    });
}

function getMediaMessage(message) {
    if (!message) return null;
    if (message.ephemeralMessage?.message) return getMediaMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getMediaMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2?.message) return getMediaMessage(message.viewOnceMessageV2.message);
    if (message.documentWithCaptionMessage?.message) return getMediaMessage(message.documentWithCaptionMessage.message);
    
    if (message.audioMessage || message.videoMessage) {
        return message;
    }
    return null;
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
                connected: !!(sock && sock.user),
            }));
        }

        if (url === '/test-wa' && method === 'POST') {
            let body = '';
            req.on('data', d => body += d);
            req.on('end', async () => {
                try {
                    if (!sock || !sock.user) return respond(res, 503, { error: 'Not fully connected/authenticated' });
                    const payload = JSON.parse(body || '{}');
                    const message = payload.message || '✅ WhatsApp connection test successful!';
                    let targetJid = payload.to;
                    if (targetJid) {
                        targetJid = targetJid.includes('@') ? targetJid : `${targetJid.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    } else {
                        targetJid = sock.user.id;
                    }
                    console.log(`[WA-Client] Sending test message to ${targetJid}: ${message}`);
                    await sock.sendMessage(targetJid, { text: message });
                    respond(res, 200, { success: true, me: sock.user, userId: TARGET_USER_ID, sentTo: targetJid });
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