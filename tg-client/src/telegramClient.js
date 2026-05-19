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
let myUserId = null;
const WHISPER_MODEL = 'openai/whisper-large-v3-turbo';

function logUpdate(update) {
    const type = update['_'] || update['@type'];
    if (type === 'updateFile') {
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
    const model = WHISPER_MODEL;

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

const incomingQueue = [];
let isProcessingQueue = false;

export function splitTextIntoChunks(text, limit = 3900) {
    if (!text) return [];
    if (text.length <= limit) {
        return [text];
    }

    const chunks = [];
    let currentChunk = "";

    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
        // If adding this paragraph exceeds the limit
        if ((currentChunk + (currentChunk ? '\n' : '') + paragraph).length > limit) {
            // If the paragraph itself is longer than limit, we need to split it
            if (paragraph.length > limit) {
                // Commit currentChunk if it's not empty
                if (currentChunk) {
                    chunks.push(currentChunk);
                    currentChunk = "";
                }

                // Split by sentences using regex, fallback to paragraph
                const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) || [paragraph];
                for (const sentence of sentences) {
                    const cleanSentence = sentence.trim();
                    if (!cleanSentence) continue;

                    if ((currentChunk + (currentChunk ? ' ' : '') + cleanSentence).length > limit) {
                        if (cleanSentence.length > limit) {
                            if (currentChunk) {
                                chunks.push(currentChunk);
                                currentChunk = "";
                            }
                            const words = cleanSentence.split(/\s+/).filter(Boolean);
                            for (const word of words) {
                                if ((currentChunk + (currentChunk ? ' ' : '') + word).length > limit) {
                                    if (word.length > limit) {
                                        if (currentChunk) {
                                            chunks.push(currentChunk);
                                            currentChunk = "";
                                        }
                                        let tempWord = word;
                                        while (tempWord.length > limit) {
                                            chunks.push(tempWord.substring(0, limit));
                                            tempWord = tempWord.substring(limit);
                                        }
                                        currentChunk = tempWord;
                                    } else {
                                        chunks.push(currentChunk);
                                        currentChunk = word;
                                    }
                                } else {
                                    currentChunk = currentChunk ? currentChunk + ' ' + word : word;
                                }
                            }
                        } else {
                            chunks.push(currentChunk);
                            currentChunk = cleanSentence;
                        }
                    } else {
                        currentChunk = currentChunk ? currentChunk + ' ' + cleanSentence : cleanSentence;
                    }
                }
            } else {
                chunks.push(currentChunk);
                currentChunk = paragraph;
            }
        } else {
            currentChunk = currentChunk ? currentChunk + '\n' + paragraph : paragraph;
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks.filter(Boolean);
}

async function safeSendMessage(chatId, replyToMessageId, text, attempt = 1) {
    try {
        const result = await client.invoke({
            '_': 'sendMessage',
            chat_id: chatId,
            reply_to_message_id: replyToMessageId,
            input_message_content: {
                '_': 'inputMessageText',
                text: {
                    '_': 'formattedText',
                    text: text
                }
            }
        });
        return result;
    } catch (err) {
        const errorMsg = err.message || '';
        if (errorMsg.includes('FLOOD_WAIT_') && attempt <= 3) {
            const match = errorMsg.match(/FLOOD_WAIT_(\d+)/);
            const waitSeconds = match ? parseInt(match[1], 10) : 5;
            console.warn(`[tg-client] ⚠️ FLOOD_WAIT encountered. Waiting for ${waitSeconds} seconds before retry (attempt ${attempt}/3)...`);
            await new Promise(resolve => setTimeout(resolve, waitSeconds * 1000 + 500));
            return safeSendMessage(chatId, replyToMessageId, text, attempt + 1);
        }
        throw err;
    }
}

async function deleteMessage(chatId, messageId) {
    if (!messageId) return;
    try {
        await client.invoke({
            '_': 'deleteMessages',
            chat_id: chatId,
            message_ids: [messageId],
            revoke: true
        });
        console.log(`[tg-client] 🗑️ Deleted processing status message ${messageId} in chat ${chatId}`);
    } catch (deleteErr) {
        console.warn(`[tg-client] Failed to delete status message ${messageId}:`, deleteErr.message);
    }
}

async function processIncomingQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (incomingQueue.length > 0) {
        const message = incomingQueue.shift();
        try {
            console.log(`[tg-client] 🔄 Processing message ${message.id} from queue. Remaining: ${incomingQueue.length}`);
            await processSingleMessage(message);
        } catch (queueErr) {
            console.error(`[tg-client] Error processing message ${message.id} from queue:`, queueErr.message);
        }

        if (incomingQueue.length > 0) {
            console.log(`[tg-client] ⏳ Waiting 1.5s before next queued message...`);
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    isProcessingQueue = false;
}

export async function handleNewMessage(message) {
    if (!message || !message.content) return;

    const chat_id = message.chat_id;
    const type = message.content['_'];

    // Fast pre-filtering to avoid clogging the queue:
    // 1. Group filtering: Only private messages
    const isGroup = (typeof chat_id === 'number' && chat_id < 0) || (typeof chat_id === 'string' && chat_id.startsWith('-'));
    if (isGroup) {
        return;
    }

    // Outgoing message filtering
    const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
    const isSelfChat = myId && Number(chat_id) === Number(myId);
    if (message.is_outgoing && !isSelfChat) {
        return;
    }

    // Log text messages immediately without queueing them
    if (type === 'messageText') {
        const text = message.content.text?.text || '';
        console.log(`[tg-client] 💬 Text: "${text}"`);
        return;
    }

    // Queue media messages
    if (type === 'messageVoiceNote' || type === 'messageVideoNote') {
        console.log(`[tg-client] 📥 Enqueuing media message ${message.id} in chat ${chat_id}`);
        incomingQueue.push(message);
        processIncomingQueue();
    }
}

async function processSingleMessage(message) {
    if (!message || !message.content) return;

    const chat_id = message.chat_id;
    const message_id = message.id;
    const type = message.content['_'];

    // 1. Group filtering: Only private messages
    const isGroup = (typeof chat_id === 'number' && chat_id < 0) || (typeof chat_id === 'string' && chat_id.startsWith('-'));
    if (isGroup) {
        return;
    }

    // Outgoing message filtering
    const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
    const isSelfChat = myId && Number(chat_id) === Number(myId);
    if (message.is_outgoing) {
        if (!isSelfChat) {
            return;
        }
        console.log(`[tg-client] 📥 Processing outgoing message ${message_id} in Saved Messages/self chat`);
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

    console.log(`[tg-client] 📩 Processing media message in chat ${chat_id} of type: ${type}`);

    if (type === 'messageVoiceNote') {
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
        let statusMessage = null;
        try {
            // Send immediate transcription status message to the user
            try {
                const statusText = type === 'messageVideoNote'
                    ? '📹 Обрабатываю видео-кружок, идет транскрибация...'
                    : '🎤 Обрабатываю голосовое сообщение, идет транскрибация...';
                statusMessage = await safeSendMessage(chat_id, message_id, statusText);
            } catch (statusErr) {
                console.warn(`[tg-client] Failed to send status message:`, statusErr.message);
            }

            const fileIdNum = Number(file_id);

            // Register the promise before invoking the download to avoid race conditions!
            let downloadPromise = null;
            if (!filePromises.has(fileIdNum)) {
                downloadPromise = new Promise((resolve, reject) => {
                    const pollInterval = setInterval(async () => {
                        try {
                            const currentFile = await client.invoke({
                                '_': 'getFile',
                                file_id: file_id
                            });
                            if (currentFile && currentFile.local && currentFile.local.is_completed) {
                                console.log(`[tg-client] ℹ️ Polling fallback detected completed download for file ${file_id}`);
                                clearInterval(pollInterval);
                                clearTimeout(timeout);
                                filePromises.delete(fileIdNum);
                                resolve(currentFile);
                            }
                        } catch (pollErr) {
                            // Ignore errors during polling
                        }
                    }, 1000);

                    const timeout = setTimeout(() => {
                        clearInterval(pollInterval);
                        filePromises.delete(fileIdNum);
                        reject(new Error(`File download timed out for file ${file_id}`));
                    }, 60000); // 60s timeout

                    filePromises.set(fileIdNum, {
                        resolve: (f) => {
                            clearInterval(pollInterval);
                            clearTimeout(timeout);
                            resolve(f);
                        },
                        reject: (err) => {
                            clearInterval(pollInterval);
                            clearTimeout(timeout);
                            reject(err);
                        }
                    });
                });
            }

            // 1. Download file
            console.log(`[tg-client] ⏳ Downloading file ${file_id}...`);
            const downloadStart = Date.now();
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
            const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(2);

            console.log(`[tg-client] ✅ Downloaded to ${localPath} in ${downloadDuration}s. Reading...`);

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
            const transcriptionStart = Date.now();
            const transcription = await transcribeAudio(buffer, currentMimeType);
            const transcriptionDuration = ((Date.now() - transcriptionStart) / 1000).toFixed(2);
            console.log(`[tg-client] ✅ Transcription: "${transcription.slice(0, 50)}..." in ${transcriptionDuration}s`);

            if (transcription.trim()) {
                // Split transcription into chunks to respect character limits and avoid FLOOD_WAIT
                const chunks = splitTextIntoChunks(transcription.trim(), 3900);
                const totalChunks = chunks.length;

                for (let i = 0; i < totalChunks; i++) {
                    let replyText = "";
                    if (totalChunks === 1) {
                        replyText = `🎤 ${chunks[i]}\n\n` +
                            `⏱ Скачивание: ${downloadDuration}с | Транскрибация: ${transcriptionDuration}с\n` +
                            `🤖 Модель: ${WHISPER_MODEL}`;
                    } else {
                        const chunkIndex = i + 1;
                        if (chunkIndex === 1) {
                            replyText = `🎤 (Часть ${chunkIndex}/${totalChunks})\n\n${chunks[i]}`;
                        } else if (chunkIndex < totalChunks) {
                            replyText = `(Часть ${chunkIndex}/${totalChunks})\n\n${chunks[i]}`;
                        } else {
                            replyText = `(Часть ${chunkIndex}/${totalChunks})\n\n${chunks[i]}\n\n` +
                                `⏱ Скачивание: ${downloadDuration}с | Транскрибация: ${transcriptionDuration}с\n` +
                                `🤖 Модель: ${WHISPER_MODEL}`;
                        }
                    }

                    console.log(`[tg-client] 📤 Sending chunk ${i + 1}/${totalChunks} (length: ${replyText.length})...`);
                    await safeSendMessage(chat_id, message_id, replyText);

                    // Add a delay of 1.5 seconds between successive chunk sends to avoid Telegram spam limits
                    if (i < totalChunks - 1) {
                        console.log(`[tg-client] ⏳ Waiting 1.5s before sending next chunk...`);
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    }
                }

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
            logError(e, 'processSingleMessage');
        } finally {
            // Delete the transcription status message if it was sent
            if (statusMessage && statusMessage.id) {
                await deleteMessage(chat_id, statusMessage.id);
            }

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

    // Fetch and cache our own user ID
    try {
        const me = await client.invoke({ '_': 'getMe' });
        myUserId = me.id;
        console.log(`[tg-client] 👤 Authenticated user ID cached: ${myUserId}`);
    } catch (meErr) {
        console.error(`[tg-client] Failed to cache user ID during login:`, meErr.message);
    }
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
