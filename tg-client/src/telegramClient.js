import { createClient } from './utils.js';
import { 
    TARGET_USER_ID, TG_API_ID, TG_API_HASH, 
    WHISPER_TURBO_URL, WHISPER_PROVIDER,
    MANAGER_URL, MANAGER_SECRET, TG_SESSION,
    DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION,
    redis
} from './config.js';
import fs from 'fs';
import path from 'path';

let client = null;
const filePromises = new Map();

function logUpdate(update) {
    if (update['_'] === 'updateFile') {
        const file = update.file;
        if (file.local.is_completed && filePromises.has(file.id)) {
            const { resolve } = filePromises.get(file.id);
            filePromises.delete(file.id);
            resolve(file);
        }
    }
}

function logError(err, context = '') {
    console.error(`[tg-client] ERROR${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
}

async function transcribeAudio(audioBuffer, mimeType) {
    const url = WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
    const model = 'openai/whisper-large-v3-turbo';

    console.log(`[tg-client] 🤖 Transcribing with Whisper Turbo at ${url}...`);

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', model);
    formData.append('language', 'auto');

    try {
        const response = await fetch(`${url}/v1/audio/transcriptions`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(60000) // 60s timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Transcriber error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        return data.text || data.transcription || '';
    } catch (e) {
        console.error(`[tg-client] Transcription failed: ${e.message}`);
        throw e;
    }
}

async function handleNewMessage(message) {
    if (!message || !message.content) return;

    const chat_id = message.chat_id;
    const message_id = message.id;
    const type = message.content['_'];
    let file_id = null;
    let mime_type = '';

    console.log(`[tg-client] 📩 Received message in chat ${chat_id} of type: ${type}`);

    if (type === 'messageText') {
        const text = message.content.text?.text || '';
        console.log(`[tg-client] 💬 Text: "${text}"`);
    } else if (type === 'messageVoiceNote') {
        file_id = message.content.voice_note.voice.id;
        mime_type = 'audio/ogg';
        console.log(`[tg-client] 🎤 Voice message detected in chat ${chat_id}`);
    } else if (type === 'messageVideoNote') {
        file_id = message.content.video_note.video.id;
        mime_type = 'video/mp4';
        console.log(`[tg-client] 📹 Video note detected in chat ${chat_id}`);
    }

    if (file_id) {
        try {
            // 1. Download file
            console.log(`[tg-client] ⏳ Downloading file ${file_id}...`);
            let file = await client.invoke({
                '_': 'downloadFile',
                file_id: file_id,
                priority: 1,
                offset: 0,
                limit: 0,
                synchronous: true
            });

            if (!file.local.is_completed) {
                console.log(`[tg-client] ⏳ Waiting for file ${file_id} to complete...`);
                file = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        filePromises.delete(file_id);
                        reject(new Error('File download timed out'));
                    }, 30000);
                    filePromises.set(file_id, { resolve: (f) => {
                        clearTimeout(timeout);
                        resolve(f);
                    }, reject });
                });
            }

            const localPath = file.local.path;
            if (!localPath) throw new Error('File download failed: no local path');

            console.log(`[tg-client] ✅ Downloaded to ${localPath}. Reading...`);
            const buffer = fs.readFileSync(localPath);

            // 2. Transcribe
            const transcription = await transcribeAudio(buffer, mime_type);
            console.log(`[tg-client] ✅ Transcription: "${transcription.slice(0, 50)}..."`);

            if (transcription.trim()) {
                // 3. Reply with transcription
                await client.invoke({
                    '_': 'sendMessage',
                    chat_id: chat_id,
                    reply_to_message_id: message_id,
                    input_message_content: {
                        '_': 'inputMessageText',
                        text: {
                            '_': 'formattedText',
                            text: `🎤 ${transcription}`
                        }
                    }
                });

                // 4. Update stats via manager
                const managerApi = MANAGER_URL || 'http://tg-client-manager:3000';
                const secret = MANAGER_SECRET || 'changeme';
                fetch(`${managerApi}/internal/stats`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
                    body: JSON.stringify({ userId: TARGET_USER_ID, secret })
                }).catch(e => console.error('[tg-client] Failed to update stats:', e.message));
            } else {
                console.log('[tg-client] ⚠️ Empty transcription, skipping reply');
            }

        } catch (e) {
            logError(e, 'handleNewMessage');
        }
    }
}

export async function startUserClient() {
    if (client) return;

    console.log(`[tg-client] Initializing user client for ${TARGET_USER_ID}...`);

    if (TG_SESSION && TG_SESSION.length > 100) {
        console.log(`[tg-client] 📦 Found session in environment, unpacking...`);
        const { unpackSession } = await import('./utils.js');
        unpackSession(TARGET_USER_ID, TG_SESSION);
    }

    client = createClient(TARGET_USER_ID);

    client.on('update', (update) => {
        logUpdate(update);
        if (update['_'] === 'updateNewMessage') {
            handleNewMessage(update.message);
        }
    });

    client.on('error', (err) => {
        logError(err, 'TDLib');
    });

    console.log(`[tg-client] Connecting to TDLib...`);
    await client.connect();
    console.log(`[tg-client] Connected! Waiting for messages...`);
}

export async function startTelegramClient() {
    await startUserClient();
}

export function stopTelegramClient() {
    if (client) {
        client.close();
        client = null;
    }
}
