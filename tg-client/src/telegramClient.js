import * as tdl from 'tdl';
import { getTdjson } from 'prebuilt-tdlib';
import { TARGET_USER_ID, TG_SESSION, TG_API_ID, TG_API_HASH, WORKER_URL, BRIDGE_SECRET, OLLAMA_BASE_URL, WHISPER_PROVIDER, WHISPER_TURBO_URL, redis } from './config.js';
import fs from 'fs';
import path from 'path';
import { unpackSession } from './utils.js';
// Removed local Redis initialization

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
            "_": "sendChatAction",
            "chat_id": chatId,
            "action": { "_": isVoice ? "chatActionRecordingVoiceNote" : "chatActionRecordingVideoNote" }
        }).catch(() => { });

        const statusMsg = await userClient.invoke({
            "_": "sendMessage",
            "chat_id": chatId,
            "reply_to_message_id": msgId,
            "input_message_content": {
                "_": "inputMessageText",
                "text": { "_": "formattedText", "text": "⏳ Transcribing audio..." }
            }
        });

        const file = isVoice ? content.voice_note.voice : content.video_note.video;
        const fileId = file.id;

        console.log(`[tg-client] ⏳ Downloading file ${fileId}...`);
        
        const downloadedFile = await userClient.invoke({
            "_": "downloadFile",
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
                "_": "editMessageText",
                "chat_id": chatId,
                "message_id": statusMsg.id,
                "input_message_content": { 
                    "_": "inputMessageText", 
                    "text": { "_": "formattedText", "text": "❌ Could not transcribe audio (empty result)." } 
                }
            }).catch(e => console.error(`[tg-client] Edit status failed:`, e.message));
            return;
        }

        console.log(`[tg-client] ✅ Transcribed (${duration.toFixed(1)}s): "${text.slice(0, 100)}..."`);
        
        const fullText = `🎤 ${text}\n\n⏱️ ${duration.toFixed(1)}s`;
        const limit = 4000;

        if (fullText.length <= limit) {
            await userClient.invoke({
                "_": "editMessageText",
                "chat_id": chatId,
                "message_id": statusMsg.id,
                "input_message_content": { 
                    "_": "inputMessageText", 
                    "text": { "_": "formattedText", "text": fullText } 
                }
            }).catch(e => console.error(`[tg-client] Edit message failed:`, e.message));
        } else {
            // Split into chunks
            const chunks = [];
            for (let i = 0; i < fullText.length; i += limit) {
                chunks.push(fullText.substring(i, i + limit));
            }

            // Edit the first message with the first chunk
            await userClient.invoke({
                "_": "editMessageText",
                "chat_id": chatId,
                "message_id": statusMsg.id,
                "input_message_content": { 
                    "_": "inputMessageText", 
                    "text": { "_": "formattedText", "text": chunks[0] } 
                }
            }).catch(e => console.error(`[tg-client] Edit first chunk failed:`, e.message));

            // Send remaining chunks as new messages
            for (let i = 1; i < chunks.length; i++) {
                await userClient.invoke({
                    "_": "sendMessage",
                    "chat_id": chatId,
                    "input_message_content": { 
                        "_": "inputMessageText", 
                        "text": { "_": "formattedText", "text": chunks[i] } 
                    }
                }).catch(e => console.error(`[tg-client] Send chunk ${i} failed:`, e.message));
            }
        }

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
    const startTime = Date.now();
    
    // Get latest config from Redis
    const provider = await redis.get("config_whisper_provider") || WHISPER_PROVIDER || 'qwen3-asr';
    
    let url = OLLAMA_BASE_URL || 'http://qwen3-asr:8000';
    let modelName = 'Qwen/Qwen3-ASR-0.6B';

    if (provider === 'whisper-turbo') {
        url = await redis.get("config_local_whisper_url") || WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
        modelName = 'openai/whisper-large-v3-turbo';
    } else if (provider === 'ollama') {
        url = await redis.get("config_ollama_url") || OLLAMA_BASE_URL || 'http://qwen3-asr:8000';
        modelName = await redis.get("config_whisper_model") || 'qwen2-audio';
    }

    console.log(`[tg-client] Using ${provider} at ${url}`);

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', modelName);
    formData.append('language', 'auto');

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${WHISPER_PROVIDER} error (${response.status}): ${errorText}`);
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
    
    let sessionToUnpack = TG_SESSION;

    // Try to get session from Redis first if not in env or as a fallback
    try {
        const redisKey = `tg_session_${TARGET_USER_ID}`;
        const redisSession = await redis.get(redisKey);
        if (redisSession) {
            console.log(`[tg-client] ⚡ Found session in Redis for ${TARGET_USER_ID} (Key: ${redisKey})`);
            sessionToUnpack = redisSession;
        } else {
            console.log(`[tg-client] ℹ️ No session found in Redis for ${TARGET_USER_ID} (Key: ${redisKey})`);
        }
    } catch (e) {
        console.warn(`[tg-client] ⚠️ Failed to fetch session from Redis:`, e.message);
    }

    if (sessionToUnpack && sessionToUnpack.length > 100) {
        console.log(`[tg-client] 📦 Attempting to restore TDLib state...`);
        unpackSession(TARGET_USER_ID, sessionToUnpack);
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
        filesDirectory: path.join(dbDir, 'files'),
        tdlibParameters: {
            use_message_database: true,
            use_chat_info_database: true,
            use_file_database: true,
            use_test_dc: false,
            device_model: process.env.DEVICE_MODEL || "Desktop Linux",
            system_version: process.env.SYSTEM_VERSION || "Ubuntu 24.04",
            application_version: process.env.APP_VERSION || "4.15.2",
            enable_storage_optimizer: true
        }
    });

    // Heartbeat to prevent K8s idle timeout and show liveness
    setInterval(() => {
        console.log(`[tg-client] 💓 Heartbeat: Client for ${TARGET_USER_ID} is active`);
    }, 60000);

    // Register listener BEFORE login to catch all updates
    userClient.on('update', async (update) => {
        const type = update['_'] || update['@type'];
        if (type === 'updateAuthorizationState') {
            const state = update.authorization_state;
            const stateType = state['_'] || state['@type'];
            console.log(`[tg-client] 🔑 Auth State: ${stateType}`);
            
            if (stateType === 'authorizationStateReady') {
                console.log(`[tg-client] 🚀 Client Ready!`);
            }

            if (stateType === 'authorizationStateLoggingOut' || stateType === 'authorizationStateWaitPhoneNumber') {
                console.warn(`[tg-client] ⚠️ Session revoked or expired (State: ${stateType}). Notifying worker...`);
                if (WORKER_URL) {
                    try {
                        await fetch(`${WORKER_URL}/internal/access-revoked`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: TARGET_USER_ID, secret: BRIDGE_SECRET })
                        });
                        console.log(`[tg-client] ✅ Worker notified. Exiting...`);
                    } catch (e) {
                        console.error(`[tg-client] ❌ Failed to notify worker:`, e.message);
                    }
                }
                process.exit(0);
            }

            if (stateType === 'authorizationStateClosed') {
                console.log(`[tg-client] 🛑 TDLib closed. Exiting...`);
                process.exit(0);
            }
        }
        
        if (type === 'updateNewMessage') {
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
