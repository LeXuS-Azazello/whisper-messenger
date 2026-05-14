import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { TARGET_USER_ID, TG_SESSION, TG_API_ID, TG_API_HASH, WORKER_URL, BRIDGE_SECRET, OLLAMA_BASE_URL } from './config.js';
import fs from 'fs';
import path from 'path';
import { unpackSession } from './utils.js';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379');
let userClient = null;

async function handleNewMessage(update) {
    const msg = update.message;
    if (!msg || msg.is_outgoing) return;

    const content = msg.content;
    const isVoice = content['@type'] === 'messageVoiceNote';
    const isVideoNote = content['@type'] === 'messageVideoNote';

    if (!isVoice && !isVideoNote) return;

    console.log(`[tg-client] 🎤 New ${isVoice ? 'voice' : 'video'} note in chat ${msg.chat_id} (Msg ID: ${msg.id})`);

    try {
        const chatId = msg.chat_id;
        const msgId = msg.id;

        await userClient.invoke({
            "@type": "sendChatAction",
            "chat_id": chatId,
            "action": { "@type": isVoice ? "chatActionRecordingVoiceNote" : "chatActionRecordingVideoNote" }
        }).catch(() => { });

        const statusMsg = await userClient.invoke({
            "@type": "sendMessage",
            "chat_id": chatId,
            "reply_to_message_id": msgId,
            "input_message_content": {
                "@type": "inputMessageText",
                "text": { "@type": "formattedText", "text": "⏳ Transcribing audio..." }
            }
        });

        const file = isVoice ? content.voice_note.voice : content.video_note.video;
        const fileId = file.id;

        console.log(`[tg-client] ⏳ Downloading file ${fileId}...`);
        
        const downloadedFile = await userClient.invoke({
            "@type": "downloadFile",
            "file_id": fileId,
            "priority": 32,
            "offset": 0,
            "limit": 0,
            "synchronous": true
        });

        if (!downloadedFile.local.path) {
            throw new Error('File download failed (no local path)');
        }

        const filePath = downloadedFile.local.path;
        const buffer = fs.readFileSync(filePath);
        const mimeType = isVoice ? 'audio/ogg' : 'video/mp4';
        
        const fileUniqueId = downloadedFile.remote.unique_id;
        const cacheKey = `transcription:${fileUniqueId}`;
        
        // Try to get from cache first
        let text = await redis.get(cacheKey);
        let duration = 0;

        if (text) {
            console.log(`[tg-client] ⚡ Cache hit for ${fileUniqueId}`);
        } else {
            console.log(`[tg-client] 💾 Downloaded ${buffer.length} bytes. Starting transcription...`);
            const result = await transcribeAudio(buffer, mimeType);
            text = result.text;
            duration = result.duration;
            
            // Save to cache for 24 hours
            if (text) {
                await redis.set(cacheKey, text, 'EX', 86400);
            }
        }

        if (!text || text.trim().length === 0) {
            console.log(`[tg-client] ❌ Transcription returned empty text.`);
            await userClient.invoke({
                "@type": "editMessageText",
                "chat_id": chatId,
                "message_id": statusMsg.id,
                "input_message_content": { 
                    "@type": "inputMessageText", 
                    "text": { "@type": "formattedText", "text": "❌ Could not transcribe audio (empty result)." } 
                }
            }).catch(e => console.error(`[tg-client] Edit status failed:`, e.message));
            return;
        }

        console.log(`[tg-client] ✅ Transcribed (${duration.toFixed(1)}s): "${text.slice(0, 100)}..."`);
        
        await userClient.invoke({
            "@type": "editMessageText",
            "chat_id": chatId,
            "message_id": statusMsg.id,
            "input_message_content": { 
                "@type": "inputMessageText", 
                "text": { "@type": "formattedText", "text": `🎤 ${text}\n\n⏱️ ${duration.toFixed(1)}s` } 
            }
        }).catch(e => console.error(`[tg-client] Edit message failed:`, e.message));

        if (WORKER_URL) {
            fetch(`${WORKER_URL}/internal/stats`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: TARGET_USER_ID, secret: BRIDGE_SECRET })
            }).catch(e => console.error('[tg-client] Stats notify failed:', e));
        }
    } catch (e) {
        console.error('[tg-client] Error processing message:', e);
    }
}

async function transcribeAudio(audioBuffer, mimeType) {
    const qwenUrl = OLLAMA_BASE_URL || 'http://qwen3-asr:8000';
    const startTime = Date.now();

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'Qwen/Qwen3-ASR-0.6B');
    formData.append('language', 'auto');

    const response = await fetch(`${qwenUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen3-ASR error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = data.text || data.transcription || '';
    const duration = (Date.now() - startTime) / 1000;

    return { text, duration };
}

export async function startUserClient() {
    if (!TARGET_USER_ID) return console.error('[tg-client] No TARGET_USER_ID provided!');

    console.log(`[tg-client] Starting TDLib client for user ${TARGET_USER_ID}...`);

    const dbDir = path.join('/app/tdlib-data', String(TARGET_USER_ID));
    
    if (TG_SESSION && TG_SESSION.length > 100) {
        console.log(`[tg-client] 📦 Found TG_SESSION, attempting to restore TDLib state...`);
        unpackSession(TARGET_USER_ID, TG_SESSION);
    } else {
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
        tdl.configure({ tdjson: getTdjson() });
    } catch (e) {
        console.warn('[tg-client] prebuilt-tdlib not loaded:', e.message);
    }

    userClient = tdl.createClient({
        apiId: Number(TG_API_ID),
        apiHash: TG_API_HASH,
        databaseDirectory: dbDir,
        filesDirectory: path.join(dbDir, 'files')
    });

    // Register listener BEFORE login to catch all updates
    userClient.on('update', async (update) => {
        if (update['_'] === 'updateAuthorizationState') {
            const state = update.authorization_state;
            console.log(`[tg-client] 🔑 Auth State: ${state['_']}`);
            
            if (state['_'] === 'authorizationStateReady') {
                console.log(`[tg-client] 🚀 Client Ready!`);
            }
        }
        
        if (update['_'] === 'updateNewMessage') {
            handleNewMessage(update);
        }
    });

    console.log(`[tg-client] Logging in...`);
    await userClient.login();
    
    console.log(`[tg-client] Listening for updates...`);
}

export function getUserClient() {
    return userClient;
}
