import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from 'baileys';
import fs from 'fs';
import path from 'path';

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local/v1/transcribe-base64';

async function processAudio(msg, sock) {
    try {
        const buffer = await downloadMediaMessage(msg, 'buffer', { }, { reuploadRequest: sock.updateMediaMessage });
        const base64Audio = buffer.toString('base64');
        const mimeType = msg.message.audioMessage ? msg.message.audioMessage.mimetype : (msg.message.videoMessage ? msg.message.videoMessage.mimetype : 'audio/ogg');
        
        console.log(`[WA-Client] Sending media to whisper (${mimeType})`);
        
        const reqBody = {
            file_base64: base64Audio,
            mime_type: mimeType,
            language: 'auto'
        };
        
        const response = await fetch(WHISPER_PROVIDER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });
        
        if (!response.ok) throw new Error(`Whisper returned ${response.status}`);
        const data = await response.json();
        
        if (data.text && data.text.trim()) {
            console.log(`[WA-Client] Transcribed: ${data.text}`);
            const jid = msg.key.remoteJid;
            await sock.sendMessage(jid, { text: data.text }, { quoted: msg });
        }
    } catch (e) {
        console.error(`[WA-Client] Error processing audio:`, e.message);
    }
}

async function connectToWhatsApp() {
    const sessionDir = '/app/sessions';
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['VoicemsgNet', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log(`[WA-Client ${TARGET_USER_ID}] Connected to WhatsApp!`);
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        if (msg.message.audioMessage || msg.message.videoMessage) {
            await processAudio(msg, sock);
        }
    });
}

connectToWhatsApp();