import { createClient } from './utils.js';
import {
    TARGET_USER_ID,
    redis
} from './config.js';
import fs from 'fs';
import { downloadTelegramFile } from './downloader.js';
import { transcribeAudio, extractAudioFromVideo, splitTextIntoChunks } from './transcriber.js';
import { safeSendMessage, deleteMessage, updateManagerStats } from './messenger.js';

let client = null;
let myUserId = null;
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;

function logError(err, context = '') {
    console.error(`[tg-client] ERROR${context ? ' ' + context : ''}:`, err?.stack || err?.message || err);
}

const incomingQueue = [];
let isProcessingQueue = false;

async function processIncomingQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;
    while (incomingQueue.length > 0) {
        const message = incomingQueue.shift();
        try {
            await processSingleMessage(message);
        } catch (queueErr) {
            console.error(`[tg-client] Error processing message ${message.id} from queue:`, queueErr.message);
        }
        if (incomingQueue.length > 0) await new Promise(resolve => setTimeout(resolve, 1500));
    }
    isProcessingQueue = false;
}

export async function handleNewMessage(message) {
    if (!message || !message.content) return;
    const chat_id = message.chat_id;
    const type = message.content['_'];

    const isGroup = (typeof chat_id === 'number' && chat_id < 0) || (typeof chat_id === 'string' && chat_id.startsWith('-'));
    if (isGroup) return;

    const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
    const isSelfChat = myId && Number(chat_id) === Number(myId);
    if (message.is_outgoing && !isSelfChat) return;

    if (type === 'messageText') return;

    if (type === 'messageVoiceNote' || type === 'messageVideoNote') {
        if (!myUserId && client) {
            try {
                const me = await client.invoke({ '_': 'getMe' });
                myUserId = me.id;
            } catch (meErr) {}
        }

        const currentMyId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
        const currentIsSelfChat = currentMyId && Number(chat_id) === Number(currentMyId);
        if (message.is_outgoing && !currentIsSelfChat) return;

        if (client) {
        try {
            const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
            if (!chat || !chat.type || (chat.type['_'] !== 'chatTypePrivate' && chat.type['_'] !== 'chatTypeSecret')) {
                return;
            }
        } catch (chatErr) {
            return;
        }

        }

        console.log(`[tg-client] Incoming private/secret message: ${type} from ${chat_id}`);
        incomingQueue.push(message);
        processIncomingQueue();
    }
}

async function processSingleMessage(message) {
    if (!message || !message.content) return;
    const chat_id = message.chat_id;
    const message_id = message.id;
    const type = message.content['_'];

    const isGroup = (typeof chat_id === 'number' && chat_id < 0) || (typeof chat_id === 'string' && chat_id.startsWith('-'));
    if (isGroup) return;

    const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
    const isSelfChat = myId && Number(chat_id) === Number(myId);
    if (message.is_outgoing && !isSelfChat) return;

    try {
        const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
        if (!chat || !chat.type || (chat.type['_'] !== 'chatTypePrivate' && chat.type['_'] !== 'chatTypeSecret')) {
            return;
        }
    } catch (chatErr) {
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    if (message.date && message.date < clientStartTime) {
        const messageAge = now - message.date;
        if (messageAge > 1800 || oldMessagesProcessed >= 10) return;
        oldMessagesProcessed++;
    }

    let file_id = null, mime_type = '';
    if (type === 'messageVoiceNote') {
        file_id = message.content.voice_note.voice.id;
        mime_type = 'audio/ogg';
    } else if (type === 'messageVideoNote') {
        file_id = message.content.video_note.video.id;
        mime_type = 'video/mp4';
    }

    if (file_id) {
        let tempAudioPath = null, localPath = null, statusMessage = null;
        try {
            const statusText = type === 'messageVideoNote' ? '📹 Transcribing circle video message...' : '🎤 Transcribing voice message...';
            statusMessage = await safeSendMessage(client, chat_id, message_id, statusText);

            const file = await downloadTelegramFile(client, file_id);
            localPath = file.local.path;
            if (!localPath) throw new Error('File download failed: no local path');

            let buffer, currentMimeType = mime_type;
            if (type === 'messageVideoNote') {
                try {
                    tempAudioPath = await extractAudioFromVideo(localPath);
                    buffer = fs.readFileSync(tempAudioPath);
                    currentMimeType = 'audio/wav';
                } catch (err) {
                    buffer = fs.readFileSync(localPath);
                }
            } else {
                buffer = fs.readFileSync(localPath);
            }

            const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
            const transcription = await transcribeAudio(buffer, currentMimeType, chat?.language || 'auto');
            if (transcription.trim()) {
                console.log(`[tg-client] Transcription result for msg ${message_id}: ${transcription.trim()}`);
                const chunks = splitTextIntoChunks(transcription.trim(), 3900);
                for (let i = 0; i < chunks.length; i++) {
                    let replyText = chunks[i];
                     if (chunks.length === 1) {
                         replyText = `🎤 ${replyText}`;
                     } else {
                         const idx = i + 1;
                         replyText = `(Part ${idx}/${chunks.length})\n\n${replyText}${idx === chunks.length ? '' : ''}`;
                     }
                    await safeSendMessage(client, chat_id, message_id, replyText);
                    if (i < chunks.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));
                }
                await updateManagerStats(TARGET_USER_ID);
            }
        } catch (e) {
            logError(e, 'processSingleMessage');
        } finally {
            if (statusMessage) await deleteMessage(client, chat_id, statusMessage.id);
            if (tempAudioPath && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
            if (file_id) {
                try { await client.invoke({ '_': 'deleteFile', file_id: file_id }); } catch {
                    if (localPath && fs.existsSync(localPath)) fs.unlinkSync(localPath);
                }
            }
        }
    }
}

export async function startUserClient() {
    if (client) return;

    let sessionData = await redis.get(`tg_session_${TARGET_USER_ID}`);
    if (sessionData && sessionData.length > 100) {
        const { unpackSession } = await import('./utils.js');
        unpackSession(TARGET_USER_ID, sessionData);
    } else if (!sessionData) {
        console.error(`[tg-client] ❌ No session found in Redis for user ${TARGET_USER_ID}.`);
    }

    client = createClient(TARGET_USER_ID);
    client.on('update', (update) => {
        const type = update['_'] || update['@type'];
        if (type === 'updateAuthorizationState' && (update.authorization_state?.['@type'] || update.authorization_state?.['_']) === 'authorizationStateReady') {
            console.log(`[tg-client] 🎉 Authorized!`);
        }
        if (type === 'updateNewMessage') handleNewMessage(update.message);
    });
    client.on('error', (err) => logError(err, 'TDLib'));

    await client.login(() => Promise.reject(new Error('SESSION_REVOKED')));

    try {
        await Promise.all([
            client.invoke({ '_': 'setOption', 'name': 'prefer_ipv6', 'value': { '_': 'optionValueBoolean', 'value': false } }),
            client.invoke({ '_': 'setOption', 'name': 'online', 'value': { '_': 'optionValueBoolean', 'value': true } }),
            client.invoke({ '_': 'setLogVerbosityLevel', 'new_verbosity_level': 3 })
        ]);
    } catch (optErr) {}

    try {
        const me = await client.invoke({ '_': 'getMe' });
        myUserId = me.id;
    } catch (meErr) {}
}

export async function sendTestMessage(messageText) {
    if (!client) throw new Error('Client not initialized');
    const me = await client.invoke({ "_": "getMe" });
    await client.invoke({
        "_": "sendMessage",
        "chat_id": me.id,
        "input_message_content": { "_": "inputMessageText", "text": { "_": "formattedText", "text": messageText || 'Test!' } }
    });
    return me;
}

export async function startTelegramClient() { await startUserClient(); }
export function stopTelegramClient() {
    if (client) { client.close(); client = null; }
}
