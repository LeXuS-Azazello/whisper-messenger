import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import QRCode from 'qrcode';
import { redis } from './config.js';
import User from './object-object-models/User.js';
import MessengerSession from './object-object-models/MessengerSession.js';
import { makeWASocket, useMultiFileAuthState, Browsers } from 'baileys';
import { spawnPod } from './k8s.js';

export const authSessions = new Map();

function packBaileysSession(userId) {
    const dbDir = path.join(process.cwd(), 'sessions', `baileys_${userId}`);
    if (!fs.existsSync(dbDir)) return null;
    try {
        const zip = new AdmZip();
        zip.addLocalFolder(dbDir);
        return zip.toBuffer().toString('base64');
    } catch (e) {
        console.error(`[auth] Failed to pack session for ${userId}:`, e.message);
        return null;
    }
}

export async function qrStart(req, res) {
    const tempId = `wa-${Date.now()}`;
    try {
        const session = { status: 'connecting', id: tempId, createdAt: Date.now(), responded: false };
        authSessions.set(tempId, session);

        const sessionDir = path.join(process.cwd(), 'sessions', `baileys_${tempId}`);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop')
        });

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;
            if (connection === 'close') {
                console.log(
                    'disconnect',
                    lastDisconnect?.error?.output?.statusCode,
                    lastDisconnect?.error
                );
                if (!session.responded) {
                    session.responded = true;
                    res.status(500).json({ error: lastDisconnect?.error?.message || 'Connection closed by WhatsApp' });
                    try { sock.logout(); } catch (e) { }
                    authSessions.delete(tempId);
                }
            }
            if (qr) {
                try {
                    session.qrUrl = qr;
                    session.qrDataUrl = await QRCode.toDataURL(qr);
                    session.status = 'qr_ready';
                    if (!session.responded) {
                        session.responded = true;
                        res.json({
                            status: 'starting',
                            qrUrl: qr,
                            qrDataUrl: session.qrDataUrl,
                            token: tempId,
                            info: "After scanning the code, WhatsApp will forcibly disconnect you, forcing a reconnect such that we can present the authentication credentials. Don't worry, this is not an error"
                        });
                    }
                } catch (e) { }
            }
            if (connection === 'open') {
                session.status = 'done';
            }
        });

        session.client = sock;

        setTimeout(() => {
            if (!session.responded) {
                session.responded = true;
                res.status(500).json({ error: 'QR timeout' });
                try { sock.logout(); } catch (e) { }
                authSessions.delete(tempId);
            }
        }, 120000);
    } catch (e) {
        console.error('[auth] qrStart ERROR:', e.stack);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
}

export async function pairingStart(req, res) {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number required' });
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    const tempId = `wa-pair-${Date.now()}`;
    try {
        const session = { status: 'connecting', id: tempId, createdAt: Date.now(), responded: false };
        authSessions.set(tempId, session);

        const sessionDir = path.join(process.cwd(), 'sessions', `baileys_${tempId}`);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop')
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            if (connection === 'open') {
                session.status = 'done';
            }
        });

        session.client = sock;

        await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('Connection timed out waiting for init')), 15000);
            sock.ev.on('connection.update', ({ qr, connection, lastDisconnect }) => {
                if (qr || connection === 'open') {
                    clearTimeout(timeoutId);
                    resolve();
                }
                if (connection === 'close') {
                    clearTimeout(timeoutId);
                    reject(new Error(lastDisconnect?.error?.message || 'Connection closed before initialization'));
                }
            });
        });

        const code = await sock.requestPairingCode(cleanPhone);

        session.pairingCode = code;
        session.responded = true;

        res.json({
            success: true,
            code: code,
            pairingCode: code,
            token: tempId
        });

    } catch (e) {
        console.error('[auth] pairingStart ERROR:', e.stack);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
}

export async function qrCheck(req, res) {
    const { token, userId } = req.query;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const s = authSessions.get(token);
    if (!s) return res.json({ done: false, expired: true });

    if (s.status === 'done') {
        const targetUserId = userId || 'unknown';
        console.log(`[auth] WhatsApp Auth successful for ${targetUserId}`);

        try { s.client.end?.(); } catch { }
        await new Promise(r => setTimeout(r, 3000));

        const packed = packBaileysSession(s.id);
        if (packed) {
            await redis.set(`wa_session_${targetUserId}`, packed, 'EX', 86400 * 30);
            await User.findOneAndUpdate({ userId: String(targetUserId) }, { waSession: packed, isActive: true }, { upsert: true });
            await MessengerSession.findOneAndUpdate(
                { userId: String(targetUserId), platform: 'whatsapp' },
                { sessionData: packed, isActive: true },
                { upsert: true }
            );

            try {
                await spawnPod(targetUserId, packed);
            } catch (podErr) {
                console.error(`[auth] Failed to spawn pod:`, podErr);
            }
        }

        const tempDir = path.join(process.cwd(), 'sessions', `baileys_${s.id}`);
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

        authSessions.delete(token);
        return res.json({ done: true, userId: targetUserId });
    }

    if (Date.now() - s.createdAt > 300000) {
        try { s.client.logout(); } catch (e) { }
        authSessions.delete(token);
        return res.json({ done: false, expired: true });
    }

    res.json({ done: false });
}

export async function sendCode(req, res) {
    return res.status(400).json({ error: 'Phone/code authentication is not supported for WhatsApp Baileys. Please use QR or Pairing Code authentication.' });
}

export async function verifyCode(req, res) {
    return res.status(400).json({ error: 'Phone/code authentication is not supported for WhatsApp Baileys. Please use QR or Pairing Code authentication.' });
}

export async function verifyPassword(req, res) {
    return res.status(400).json({ error: 'Password authentication is not supported for WhatsApp Baileys. Please use QR or Pairing Code authentication.' });
}


