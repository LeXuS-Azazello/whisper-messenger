import { createClient, getLangLabel, telegramLangToNLLB, logError } from './utils.js';
import {
    TARGET_USER_ID,
    redis
} from './config.js';
import { downloadTelegramFile } from './downloader.js';
import { transcribePath, splitTextIntoChunks } from './transcriber.js';
import { safeSendMessage, deleteMessage, updateManagerStats } from './messenger.js';
import { isSamesameRequest, extractSamesameText, cloneVoiceWithSamesame } from '../shared/samesame.js';

import fs from 'fs';


let client = null;
let myUserId = null;
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;


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

    if (type === 'messageVoiceNote' || type === 'messageVideoNote') {
        incomingQueue.push(message);
        processIncomingQueue();
    }

    // SAMESAME voice cloning via reply (e.g. "!SAMESAME! hello" as reply to voice)
    if (type === 'messageText') {
        handleSamesameReplyIfNeeded(message).catch(err => {
            console.error('[samesame] Failed to handle possible SAMESAME request:', err.message);
        });
    }
}

async function processSingleMessage(message) {
    if (!message || !message.content) return;
    const chat_id = message.chat_id;
    const message_id = message.id;
    const type = message.content['_'];

    // Only process private/secret voice/video notes
    const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
    const isSelfChat = myId && Number(chat_id) === Number(myId);
    if (message.is_outgoing && !isSelfChat) return;

    try {
        const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
        if (!chat || !chat.type || (chat.type['_'] !== 'chatTypePrivate' && chat.type['_'] !== 'chatTypeSecret')) {
            return;
        }
    } catch {
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
        let filePath = null, statusMessage = null;
        try {
            const statusText = type === 'messageVideoNote'
                ? '📹 Transcribing circle video message...'
                : '🎤 Transcribing voice message...';
            statusMessage = await safeSendMessage(client, chat_id, message_id, statusText);

            const downloadStart = Date.now();
            const file = await downloadTelegramFile(client, file_id, mime_type);
            const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(1);
            filePath = file.local.path;
            if (!filePath) throw new Error('File download failed: no path');

            // === Language detection + translation target logic ===
            let userLangCode = 'ru';

            try {
                const chat = await client.invoke({ '_': 'getChat', chat_id: chat_id });
                if (chat.type['_'] === 'chatTypePrivate') {
                    const user = await client.invoke({ '_': 'getUser', user_id: chat.type.user_id });
                    if (user && user.language_code) {
                        userLangCode = user.language_code;
                    }
                }
            } catch (e) { }

            // Target language priority:
            // 1. What user set in Dashboard (PREFERRED_TRANSLATION_LANGUAGE)
            // 2. Language from user's Telegram profile
            const preferredFromEnv = process.env.PREFERRED_TRANSLATION_LANGUAGE;
            const targetLanguage = preferredFromEnv
                ? preferredFromEnv
                : telegramLangToNLLB(userLangCode);

            const transcribeStart = Date.now();

            // Always use 'auto' for proper language detection by Whisper
            const result = await transcribePath(
                filePath,
                mime_type,
                'auto',
                targetLanguage || null     // pass target only if we have one
            );

            const transcribeDuration = ((Date.now() - transcribeStart) / 1000).toFixed(1);

            const originalText = (result.text || '').trim();
            const detectedLang = result.language || 'unknown';
            const translatedText = result.translated ? result.translated.trim() : null;

            if (originalText) {
                console.log(`[tg-client] Transcription for msg ${message_id}: ${originalText}`);

                // Always show original in the language it was spoken
                const origLabel = getLangLabel(detectedLang);
                let finalText = `${origLabel} ${originalText}`;

                // Show translation on second line only if we got one
                if (translatedText) {
                    const targetLabel = getLangLabel(targetLanguage);
                    finalText += `\n\n${targetLabel} ${translatedText}`;
                }

                const chunks = splitTextIntoChunks(finalText, 3900);
                for (let i = 0; i < chunks.length; i++) {
                    let replyText = chunks[i];
                    if (chunks.length > 1) {
                        const idx = i + 1;
                        replyText = `(Part ${idx}/${chunks.length})\n\n${replyText}`;
                    }
                    if (i === chunks.length - 1) {
                        replyText += `\n\n⏳${transcribeDuration}s ⬇️${downloadDuration}s`;
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
            if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (file_id) {
                try { await client.invoke({ '_': 'deleteFile', file_id: Number(file_id) }); } catch { }
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
            client.invoke({ '_': 'setLogVerbosityLevel', 'new_verbosity_level': 1 })
        ]);
    } catch (optErr) { }

    try {
        const me = await client.invoke({ '_': 'getMe' });
        myUserId = me.id;
    } catch (meErr) { }
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

/**
 * Handle "!SAMESAME! text" replies to voice messages.
 * Uses the shared module so the same logic can be reused in WhatsApp / FB / IG clients.
 */
async function handleSamesameReplyIfNeeded(message) {
    if (!message || !message.content || message.content['_'] !== 'messageText') return;

    const text = message.content.text?.text || '';
    if (!isSamesameRequest(text)) return;

    const replyToId = message.reply_to_message_id;
    if (!replyToId) return;

    const chatId = message.chat_id;
    const cleanText = extractSamesameText(text);
    if (!cleanText) {
        await safeSendMessage(client, chatId, message.id, '⚠️ После !SAMESAME! нужно написать текст, который нужно произнести.');
        return;
    }

    try {
        // Fetch the message we are replying to
        const replied = await client.invoke({
            '_': 'getMessage',
            chat_id: chatId,
            message_id: replyToId
        });

        if (!replied || !replied.content) {
            await safeSendMessage(client, chatId, message.id, 'Не удалось получить сообщение, на которое ты ответил.');
            return;
        }

        const repliedType = replied.content['_'];
        let fileId = null;
        let mime = 'audio/ogg';

        if (repliedType === 'messageVoiceNote') {
            fileId = replied.content.voice_note?.voice?.id;
        } else if (repliedType === 'messageVideoNote') {
            fileId = replied.content.video_note?.video?.id;
            mime = 'video/mp4';
        }

        if (!fileId) {
            await safeSendMessage(client, chatId, message.id, 'Нужно ответить на голосовое сообщение или кружок.');
            return;
        }

        // Download the original voice
        const statusMsg = await safeSendMessage(client, chatId, message.id, '🎤 Клонирую голос... (SAMESAME)');
        const file = await downloadTelegramFile(client, fileId, mime);
        const audioPath = file.local?.path;
        if (!audioPath) throw new Error('Failed to download source audio');

        const audioBuffer = fs.readFileSync(audioPath);

        // Call the shared SAMESAME service
        const { audioBuffer: resultBuffer } = await cloneVoiceWithSamesame({
            sourceAudioBuffer: audioBuffer,
            text: cleanText,
            samesameSecret: process.env.SAMESAME_SECRET
        });

        // Send the cloned voice back (as voice note)
        const tempOut = `/tmp/samesame-${Date.now()}.ogg`;
        fs.writeFileSync(tempOut, resultBuffer);

        await client.invoke({
            '_': 'sendMessage',
            chat_id: chatId,
            reply_to_message_id: message.id,
            input_message_content: {
                '_': 'inputMessageVoiceNote',
                voice_note: {
                    '_': 'inputFileLocal',
                    path: tempOut
                },
                duration: 0,
                waveform: ''
            }
        });

        // cleanup
        fs.unlinkSync(tempOut);
        if (statusMsg) await deleteMessage(client, chatId, statusMsg.id);

    } catch (err) {
        console.error('[samesame] clone error:', err);
        await safeSendMessage(client, chatId, message.id, `Ошибка SAMESAME: ${err.message}`);
    }
}

export async function startTelegramClient() { await startUserClient(); }
export function stopTelegramClient() {
    if (client) { client.close(); client = null; }
}
