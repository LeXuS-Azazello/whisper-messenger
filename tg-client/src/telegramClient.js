import TdClient from './tdweb/index.js';
import { 
    TARGET_USER_ID, TG_API_ID, TG_API_HASH, 
    OLLAMA_BASE_URL, WHISPER_TURBO_URL, WHISPER_PROVIDER,
    MANAGER_URL, MANAGER_SECRET, TG_SESSION,
    DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION,
    redis
} from './config.js';
import fs from 'fs';
import path from 'path';

let client = null;
const filePromises = new Map();

function logUpdate(update) {
    // console.log('[tg-client] UPDATE:', JSON.stringify(update, null, 1));
}

function logError(err, context = '') {
    console.error(`[tg-client] ERROR${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
}

async function transcribeAudio(audioBuffer, mimeType) {
    const provider = WHISPER_PROVIDER || 'qwen3-asr';
    const qwenUrl = OLLAMA_BASE_URL || 'http://qwen3-asr:8000';
    const whisperUrl = WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
    
    const url = provider === 'whisper-turbo' ? whisperUrl : qwenUrl;
    const model = provider === 'whisper-turbo' ? 'openai/whisper-large-v3-turbo' : 'Qwen/Qwen3-ASR-0.6B';

    console.log(`[tg-client] 🤖 Transcribing with ${provider} at ${url}...`);

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', model);
    formData.append('language', 'auto');

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) throw new Error(`Transcriber error (${response.status}): ${await response.text()}`);
    const data = await response.json();
    return data.text || data.transcription || '';
}

async function handleNewMessage(message) {
    if (!message || !message.content) return;

    const chat_id = message.chat_id;
    const message_id = message.id;
    let file_id = null;
    let mime_type = '';

    if (message.content['@type'] === 'messageVoiceNote') {
        file_id = message.content.voice_note.voice.id;
        mime_type = 'audio/ogg';
        console.log(`[tg-client] 🎤 Voice message detected in chat ${chat_id}`);
    } else if (message.content['@type'] === 'messageVideoNote') {
        file_id = message.content.video_note.video.id;
        mime_type = 'video/mp4';
        console.log(`[tg-client] 📹 Video note detected in chat ${chat_id}`);
    }

    if (file_id) {
        try {
            // 1. Download file
            console.log(`[tg-client] ⏳ Downloading file ${file_id}...`);
            const file = await client.invoke({
                '@type': 'downloadFile',
                file_id: file_id,
                priority: 1,
                offset: 0,
                limit: 0,
                synchronous: true
            });

            if (!file.local.is_completed) {
                console.log(`[tg-client] ⏳ Waiting for file ${file_id} to complete...`);
                // Wait for updateFile (simplified for now as we use synchronous: true)
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
                    '@type': 'sendMessage',
                    chat_id: chat_id,
                    reply_to_message_id: message_id,
                    input_message_content: {
                        '@type': 'inputMessageText',
                        text: {
                            '@type': 'formattedText',
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
            }

        } catch (e) {
            logError(e, 'handleNewMessage');
        }
    }
}

export async function startUserClient() {
    if (client) return;

    console.log(`[tg-client] Initializing user client for ${TARGET_USER_ID}...`);

    client = new TdClient({
        onUpdate: (update) => {
            logUpdate(update);
            if (update['@type'] === 'updateNewMessage') {
                handleNewMessage(update.message);
            }
        },
        instanceName: `user_${TARGET_USER_ID}`,
        useDatabase: true
    });

    client.onError = (err) => {
        logError(err, 'TDLib');
    };

    const dbDir = `/tmp/tdlib/user_${TARGET_USER_ID}`;
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

    await client.invoke({
        '@type': 'setTdlibParameters',
        database_directory: dbDir,
        files_directory: `${dbDir}/files`,
        use_file_database: true,
        use_chat_info_database: true,
        use_message_database: true,
        use_secret_chats: false,
        api_id: TG_API_ID,
        api_hash: TG_API_HASH,
        system_language_code: 'en',
        device_model: DEVICE_MODEL,
        application_version: APP_VERSION,
        system_version: SYSTEM_VERSION,
        enable_storage_optimizer: true
    });

    console.log(`[tg-client] Waiting for authorization state...`);
    // Session should be already unpacked to dbDir by manager or restore logic
    // We just wait for auth state to become ready
}

export async function startTelegramClient() {
    // This is the debug/console-only mode used in some scripts
    await startUserClient();
}

export function stopTelegramClient() {
    if (client) {
        client.terminate();
        client = null;
    }
}
