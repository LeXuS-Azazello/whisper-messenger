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
import { exec } from 'child_process';
import { promisify } from 'util';

let client = null;
const filePromises = new Map();
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;

function logUpdate(update) {
    if (update['_'] === 'updateFile') {
        const file = update.file;
        const fileIdNum = Number(file.id);
        if (file.local.is_completed && filePromises.has(fileIdNum)) {
            const { resolve } = filePromises.get(fileIdNum);
            filePromises.delete(fileIdNum);
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
    const fileName = mimeType === 'audio/wav' ? 'audio.wav' : 'audio.ogg';
    formData.append('file', blob, fileName);
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

const execPromise = promisify(exec);

async function extractAudioFromVideo(videoPath) {
    const audioPath = videoPath + '.wav';
    console.log(`[tg-client] 🎬 Extracting audio from video note ${videoPath} to ${audioPath}...`);
    try {
        await execPromise(`ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`);
        console.log(`[tg-client] 🎬 Audio extraction completed successfully.`);
        return audioPath;
    } catch (error) {
        console.error(`[tg-client] ❌ ffmpeg audio extraction failed:`, error.message);
        throw error;
    }
}

async function handleNewMessage(message) {
    if (!message || !message.content) return;

    const chat_id = message.chat_id;
    const message_id = message.id;
    const type = message.content['_'];

    // 1. Group filtering: Only private messages
    const isGroup = (typeof chat_id === 'number' && chat_id < 0) || (typeof chat_id === 'string' && chat_id.startsWith('-'));
    if (isGroup) {
        console.log(`[tg-client] 🚫 Skipping message ${message_id} because chat ${chat_id} is a group/channel`);
        return;
    }

    try {
        const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
        if (chat && chat.type) {
            const chatType = chat.type['_'];
            if (chatType !== 'chatTypePrivate' && chatType !== 'chatTypeSecret') {
                console.log(`[tg-client] 🚫 Skipping message ${message_id} because chat ${chat_id} is of type "${chatType}" (only private/secret chats allowed)`);
                return;
            }
        }
    } catch (chatErr) {
        console.warn(`[tg-client] Warning: Failed to get chat info for ${chat_id}:`, chatErr.message);
    }

    // Ignore old history messages received on startup
    const now = Math.floor(Date.now() / 1000);
    if (message.date) {
        const messageAge = now - message.date;
        if (message.date < clientStartTime) {
            if (messageAge > 1800) { // 30 minutes
                console.log(`[tg-client] ⏳ Ignoring very old startup message ${message_id} in chat ${chat_id} (age: ${messageAge}s)`);
                return;
            }
            if (oldMessagesProcessed >= 10) {
                console.log(`[tg-client] ⏳ Skipping startup message ${message_id} in chat ${chat_id} (limit of 10 reached)`);
                return;
            }
            oldMessagesProcessed++;
            console.log(`[tg-client] 📥 Processing recent startup message ${message_id} in chat ${chat_id} (${oldMessagesProcessed}/10, age: ${messageAge}s)`);
        }
    }

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
        let tempAudioPath = null;
        let localPath = null;
        try {
            const fileIdNum = Number(file_id);

            // Register the promise before invoking the download to avoid race conditions!
            let downloadPromise = null;
            if (!filePromises.has(fileIdNum)) {
                downloadPromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        filePromises.delete(fileIdNum);
                        reject(new Error(`File download timed out for file ${file_id}`));
                    }, 30000);
                    filePromises.set(fileIdNum, {
                        resolve: (f) => {
                            clearTimeout(timeout);
                            resolve(f);
                        },
                        reject: (err) => {
                            clearTimeout(timeout);
                            reject(err);
                        }
                    });
                });
            }

            // 1. Download file
            console.log(`[tg-client] ⏳ Downloading file ${file_id}...`);
            let file = await client.invoke({
                '_': 'downloadFile',
                file_id: file_id,
                priority: 1,
                offset: 0,
                limit: 0,
                synchronous: false // Rely on updates and avoid blocking behavior
            });

            // If it was already completed, resolve and clean up immediately
            if (file.local.is_completed) {
                if (filePromises.has(fileIdNum)) {
                    const { resolve } = filePromises.get(fileIdNum);
                    filePromises.delete(fileIdNum);
                    resolve(file);
                }
            } else {
                console.log(`[tg-client] ⏳ Waiting for file ${file_id} to complete...`);
                // Wait for the registered download promise
                file = await downloadPromise;
            }

            localPath = file.local.path;
            if (!localPath) throw new Error('File download failed: no local path');

            console.log(`[tg-client] ✅ Downloaded to ${localPath}. Reading...`);
            
            let buffer;
            let currentMimeType = mime_type;

            if (type === 'messageVideoNote') {
                try {
                    tempAudioPath = await extractAudioFromVideo(localPath);
                    buffer = fs.readFileSync(tempAudioPath);
                    currentMimeType = 'audio/wav';
                } catch (err) {
                    console.error('[tg-client] Failed to extract audio from video note, falling back to original file:', err.message);
                    buffer = fs.readFileSync(localPath);
                }
            } else {
                buffer = fs.readFileSync(localPath);
            }

            // 2. Transcribe
            const transcription = await transcribeAudio(buffer, currentMimeType);
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
        } finally {
            // Clean up temporary extracted WAV audio file if it was created
            if (tempAudioPath && fs.existsSync(tempAudioPath)) {
                try {
                    fs.unlinkSync(tempAudioPath);
                    console.log(`[tg-client] 🗑️ Cleaned up temporary audio file: ${tempAudioPath}`);
                } catch (cleanupErr) {
                    console.error(`[tg-client] Failed to delete temporary audio file:`, cleanupErr.message);
                }
            }

            // Clean up TDLib downloaded file to avoid cluttering local storage
            if (file_id) {
                try {
                    await client.invoke({
                        '_': 'deleteFile',
                        file_id: file_id
                    });
                    console.log(`[tg-client] 🗑️ Successfully deleted cached TDLib media file: ${file_id}`);
                } catch (deleteErr) {
                    console.error(`[tg-client] Failed to delete TDLib file ${file_id}:`, deleteErr.message);
                    
                    // Fallback: if TDLib deletion fails, try deleting the file directly from filesystem
                    if (localPath && fs.existsSync(localPath)) {
                        try {
                            fs.unlinkSync(localPath);
                            console.log(`[tg-client] 🗑️ Fallback: Deleted downloaded file directly from filesystem: ${localPath}`);
                        } catch (fsErr) {
                            console.error(`[tg-client] Fallback direct deletion failed for ${localPath}:`, fsErr.message);
                        }
                    }
                }
            }
        }
    }
}

export async function startUserClient() {
    if (client) return;

    console.log(`[tg-client] Initializing user client for ${TARGET_USER_ID}...`);

    let sessionData = TG_SESSION;
    if (!sessionData || sessionData.length < 100) {
        console.log(`[tg-client] 🔍 Session not in environment, checking Redis...`);
        try {
            sessionData = await redis.get(`tg_session_${TARGET_USER_ID}`);
            if (sessionData) {
                console.log(`[tg-client] 📦 Found session in Redis (length: ${sessionData.length})`);
            }
        } catch (redisErr) {
            console.error(`[tg-client] Failed to get session from Redis:`, redisErr.message);
        }
    }

    if (sessionData && sessionData.length > 100) {
        console.log(`[tg-client] 📦 Unpacking session...`);
        const { unpackSession } = await import('./utils.js');
        unpackSession(TARGET_USER_ID, sessionData);
    }

    client = createClient(TARGET_USER_ID);

    client.on('update', (update) => {
        logUpdate(update);

        const type = update['_'] || update['@type'];

        if (type === 'updateAuthorizationState') {
            const state = update.authorization_state?.['@type'] || update.authorization_state?.['_'];
            console.log(`[tg-client-auth] 🔑 Authorization state: ${state}`);
            if (state === 'authorizationStateReady') {
                console.log(`[tg-client-auth] 🎉 SUCCESS: TELEGRAM ACCOUNT SUCCESSFULLY CONNECTED AND AUTHORIZED! Ready to listen and transcribe voice notes.`);
            }
        }

        if (type === 'updateNewMessage') {
            handleNewMessage(update.message);
        }
    });

    client.on('error', (err) => {
        logError(err, 'TDLib');
    });

    console.log(`[tg-client] Logging into TDLib...`);
    await client.login(() => ({
        getPhoneNumber: () => Promise.reject(new Error('SESSION_REVOKED: Headless client cannot prompt for phone')),
        getAuthCode: () => Promise.reject(new Error('SESSION_REVOKED: Headless client cannot prompt for auth code')),
        getPassword: () => Promise.reject(new Error('SESSION_REVOKED: Headless client cannot prompt for password'))
    }));
    console.log(`[tg-client] Logged in successfully! Waiting for messages...`);
}

export async function sendTestMessage(messageText) {
    if (!client) {
        throw new Error('Telegram client is not initialized or connected.');
    }
    const me = await client.invoke({ "_": "getMe" });
    const msgText = messageText || 'Test from Whisper Messenger!';
    console.log(`[tg-client] Sending test message to self (${me.id})`);

    await client.invoke({
        "_": "sendMessage",
        "chat_id": me.id,
        "input_message_content": {
            "_": "inputMessageText",
            "text": { "_": "formattedText", "text": msgText }
        }
    });
    return me;
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
