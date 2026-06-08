import { createClient, getLangLabel, logError } from './utils.js';
import translate from 'google-translate-api-x';

import {
    TARGET_USER_ID,
    redis
} from './config.js';

import {
    downloadTelegramFile,
    handleFileUpdate
} from './downloader.js';

import {
    transcribePath,
    splitTextIntoChunks
} from './transcriber.js';

import {
    safeSendMessage,
    deleteMessage,
    updateManagerStats,
    startChatAction
} from './messenger.js';

import {
    isSamesameRequest,
    parseSamesameRequest,
    cloneVoiceWithSamesame,
    translateSamesameText
} from '../shared/samesame.js';

import fs from 'fs';
import crypto from 'crypto';

import { execFile } from 'child_process';
import { promisify } from 'util';


let client = null;
let myUserId = null;
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;

export const pendingUploads = new Map();
export const botGeneratedMsgIds = new Set();

const processedMessages = new Set();

function alreadyProcessed(messageId) {
    if (!messageId) return false;

    if (processedMessages.has(messageId)) {
        return true;
    }

    processedMessages.add(messageId);

    if (processedMessages.size > 5000) {
        const first = processedMessages.values().next().value;
        processedMessages.delete(first);
    }

    return false;
}

function extractReplyId(msg) {
    return (
        msg.reply_to_message_id ||
        msg.reply_to?.message_id ||
        msg.reply_to?.origin?.message_id ||
        msg.replyTo?.message_id ||
        msg.reply_to?.message?.id ||
        null
    );
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

    if (alreadyProcessed(message.id)) {
        return;
    }

    const chat_id = message.chat_id;
    const type = message.content['_'];

    const isGroup =
        (typeof chat_id === 'number' && chat_id < 0) ||
        (typeof chat_id === 'string' && chat_id.startsWith('-'));

    if (isGroup) return;

    if (
        type === 'messageVoiceNote' ||
        type === 'messageVideoNote'
    ) {
        incomingQueue.push(message);

        if (!isProcessingQueue) {
            processIncomingQueue().catch(console.error);
        }

        return;
    }

    if (type === 'messageText') {
        handleSamesameReplyIfNeeded(message)
            .catch(err => {
                console.error(
                    '[samesame]',
                    err.message
                );
            });
    }
}

async function processSingleMessage(message) {
    if (!message || !message.content) return;
    if (botGeneratedMsgIds.has(message.id)) {
        console.log(`[tg-client] Ignoring bot-generated message ${message.id} to prevent loop/duplicate`);
        return;
    }
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
        let filePath = null, statusAction = null, tempWavPath = null;
        try {
            statusAction = startChatAction(client, chat_id, 'chatActionTyping');

            console.time(`[tg-client] Download msg ${message_id}`);
            const downloadStart = Date.now();
            const file = await downloadTelegramFile(client, file_id, mime_type);
            console.timeEnd(`[tg-client] Download msg ${message_id}`);
            const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(1);
            filePath = file.local.path;
            if (!filePath) throw new Error('File download failed: no path');

            let transcriptionPath = filePath;
            let transcriptionMime = mime_type;

            // FunASR handles video/mp4 directly via its internal ffmpeg extraction now
            // Just detect language or use forced preference
            console.time(`[tg-client] Transcribe msg ${message_id}`);
            const transcribeStart = Date.now();

            let asrLang = 'auto';
            try {
                const forcedLang = await redis.get(`transcription_lang_${TARGET_USER_ID}`);
                if (forcedLang) asrLang = forcedLang;
            } catch (err) {
                console.error(`[tg-client] Failed to read transcription_lang:`, err.message);
            }

            const totalStart = Date.now();

            const stat = fs.statSync(transcriptionPath);

            console.log(
                `[tg-client] audio size ${(stat.size / 1024 / 1024).toFixed(2)}MB`
            );

            const audioBuffer =
                await fs.promises.readFile(transcriptionPath);

            const hash = crypto
                .createHash('sha256')
                .update(audioBuffer)
                .digest('hex');

            const cacheKey =
                `asr:${hash}:${asrLang}`;

            let result;

            const cached =
                await redis.get(cacheKey);

            if (cached) {

                result = JSON.parse(cached);

                console.log(
                    `[tg-client] cache hit ${message_id}`
                );

            } else {

                result = await transcribePath(
                    transcriptionPath,
                    transcriptionMime,
                    asrLang
                );

                await redis.set(
                    cacheKey,
                    JSON.stringify(result),
                    'EX',
                    60 * 60 * 24 * 30
                );
            }

            console.log(
                `[tg-client] total ${(Date.now() - totalStart) / 1000}s`
            );

            const transcribeDuration = ((Date.now() - transcribeStart) / 1000).toFixed(1);

            const originalText = result?.text || '';
            const detectedLang = result?.language || '';
            const usedModel = result?.model || 'unknown model';
            const metrics = result?.metrics;

            if (originalText) {
                console.log(`[tg-client] Transcription for msg ${message_id} completed via model: ${usedModel}. Text length: ${originalText.length}`);

                let finalText = originalText;
                const label = getLangLabel(detectedLang);
                let finalLabel = label;

                // Handle Translation
                try {
                    let targetLang = null;
                    try {
                        const rawMeta = await redis.get(`user_meta_${TARGET_USER_ID}`);
                        if (rawMeta) {
                            const meta = JSON.parse(rawMeta);
                            targetLang = meta.preferredTranslationLanguage || meta.preferred_translation_lang || 'off';
                        }
                    } catch (err) {
                        console.error(`[tg-client] Failed to read user_meta for translation:`, err.message);
                    }
                    if (!targetLang) targetLang = 'translate_off'; // Default: no translation unless requested

                    if (targetLang !== 'translate_off' && targetLang !== 'off') {
                        if (targetLang === 'messenger_system_lang' || targetLang === 'auto') {
                            const me = await client.invoke({ '_': 'getUser', 'user_id': myUserId || TARGET_USER_ID });
                            targetLang = me?.language_code || 'en';
                        }

                        // Only translate if the detected language is not the target language
                        // and detectedLang is not 'auto'
                        const isSameLanguage = detectedLang && targetLang
                            && (detectedLang.toLowerCase().startsWith(targetLang.toLowerCase())
                                || targetLang.toLowerCase().startsWith(detectedLang.toLowerCase()));

                        if (!isSameLanguage) {
                            console.time(`[tg-client] Translate msg ${message_id} to ${targetLang}`);
                            const translationTarget = targetLang.toLowerCase() === 'ua' ? 'uk' : targetLang;
                            const transResult = await translate(originalText, { to: translationTarget });
                            console.timeEnd(`[tg-client] Translate msg ${message_id} to ${targetLang}`);

                            if (transResult && transResult.text) {
                                finalText = transResult.text + `\n\n_(${label} → ${getLangLabel(targetLang)})_\n_Orig: ${originalText}_`;
                                finalLabel = ''; // Label included in footer
                            }
                        }
                    }
                } catch (transErr) {
                    console.error(`[tg-client] Translation error for msg ${message_id}:`, transErr.message);
                }

                if (finalLabel) finalText = `${finalLabel} ${finalText}`;

                const chunks = splitTextIntoChunks(finalText, 3900);
                for (let i = 0; i < chunks.length; i++) {
                    let replyText = chunks[i];
                    if (chunks.length > 1) {
                        const idx = i + 1;
                        replyText = `(Part ${idx}/${chunks.length})\n\n${replyText}`;
                    }
                    // Append metrics and model name on the last part
                    if (i === chunks.length - 1) {
                        replyText += `\n\n🤖 ${usedModel} | ⏱ ${transcribeDuration}s`;
                    }
                    await safeSendMessage(client, chat_id, message_id, replyText);
                    if (i < chunks.length - 1) await new Promise(resolve => setTimeout(resolve, 1500));
                }
                await updateManagerStats(TARGET_USER_ID);
            }
        } catch (e) {
            logError(e, 'processSingleMessage');
            if (e.cause) {
                console.error('[tg-client] processSingleMessage error cause:', e.cause);
            }
        } finally {
            if (statusAction) statusAction.stop();
            if (file_id) {
                try { await client.invoke({ '_': 'deleteFile', file_id: Number(file_id) }); } catch { }
            }
            if (tempWavPath) {
                try { fs.unlinkSync(tempWavPath); } catch (_) { }
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

        if (type === 'updateMessageSendSucceeded' || type === 'updateMessageSendFailed') {
            const oldId = update.old_message_id;

            if (oldId && botGeneratedMsgIds.has(oldId)) {
                if (type === 'updateMessageSendSucceeded' && update.message?.id) {
                    botGeneratedMsgIds.add(update.message.id);
                }
                // We keep the oldId in the set just in case, it doesn't hurt and prevents race conditions
            }

            if (oldId && pendingUploads.has(oldId)) {
                const filePath = pendingUploads.get(oldId);
                try { fs.unlinkSync(filePath); } catch (_) { }
                pendingUploads.delete(oldId);
            }
        }
        if (type === 'updateFile') handleFileUpdate(update);
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

    if (
        !message ||
        !message.content ||
        message.content['_'] !== 'messageText'
    ) {
        return;
    }

    const text =
        message.content.text?.text || '';

    if (!isSamesameRequest(text)) {
        return;
    }

    const replyToId =
        extractReplyId(message);

    if (!replyToId) {

        await safeSendMessage(
            client,
            message.chat_id,
            message.id,
            'Ответь на голосовое сообщение.'
        );

        return;
    }

    const chatId =
        message.chat_id;

    let statusAction = startChatAction(client, chatId, 'chatActionRecordingVoiceNote');

    let {
        text: cleanText,
        language
    } = parseSamesameRequest(text);

    if (!language) {
        try {
            const rawMeta = await redis.get(`user_meta_${TARGET_USER_ID}`);
            if (rawMeta) {
                const meta = JSON.parse(rawMeta);
                const ttsLang = meta.ttsTranslationLanguage;
                if (ttsLang && ttsLang !== 'translate_off' && ttsLang !== 'off') {
                    language = ttsLang;
                    console.log(`[samesame] Using dashboard ttsTranslationLanguage: ${language}`);
                }
            }
        } catch (err) {
            console.error(`[tg-client] Failed to read ttsTranslationLanguage from user_meta:`, err.message);
        }
    }

    if (language) {
        console.time(`[tg-client] SAMESAME Translate to ${language}`);
        const translated = await translateSamesameText(cleanText, language);
        if (translated && translated !== cleanText) {
            console.log(`[samesame] translated: ${cleanText} -> ${translated}`);
            cleanText = translated;
        }
        console.timeEnd(`[tg-client] SAMESAME Translate to ${language}`);
    }

    if (!cleanText) {

        await safeSendMessage(
            client,
            chatId,
            message.id,
            'После !SAMESAME! нужен текст.'
        );

        if (statusAction) statusAction.stop();
        return;
    }
    let fileId = null;
    let mime = 'audio/ogg';

    try {
        // Fetch the message we are replying to
        const replied = await client.invoke({
            '_': 'getMessage',
            chat_id: chatId,
            message_id: replyToId
        });

        const validTypes = new Set([
            'messageVoiceNote',
            'messageVideoNote'
        ]);

        if (
            !replied ||
            !replied.content ||
            !validTypes.has(replied.content['_'])
        ) {

            await safeSendMessage(
                client,
                chatId,
                message.id,
                'Ответь именно на голосовое.'
            );

            if (statusAction) statusAction.stop();
            return;
        }

        const repliedType = replied.content['_'];
        const rawSenderId = replied.sender_id?.user_id || replied.sender_id?.chat_id || chatId;
        const senderId = `tg:${rawSenderId}`;
        console.log('[samesame] replied message fetched, type=', repliedType, 'senderId=', senderId);

        if (repliedType === 'messageVoiceNote') {
            fileId = replied.content.voice_note?.voice?.id;
        } else if (repliedType === 'messageVideoNote') {
            fileId = replied.content.video_note?.video?.id;
            mime = 'video/mp4';
        }

        console.log('[samesame] extracted fileId=', fileId, 'mime=', mime);

        if (!fileId) {
            await safeSendMessage(client, chatId, message.id, 'Нужно ответить на голосовое сообщение или кружок.');
            if (statusAction) statusAction.stop();
            return;
        }

        // Download the original voice
        console.time(`[tg-client] Download source voice (samesame) msg ${message.id}`);
        const file = await downloadTelegramFile(client, fileId, mime);
        console.timeEnd(`[tg-client] Download source voice (samesame) msg ${message.id}`);
        const audioPath = file.local?.path;
        if (!audioPath) throw new Error('Failed to download source audio');

        // TDLib can report is_downloading_completed=true while the file is not yet
        // visible to fs.readFileSync on Kubernetes emptyDir (race on some node storage).
        // Do a short retry loop so we don't crash with ENOENT on perfectly valid downloads.
        let audioBuffer = null;
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                const stat =
                    fs.statSync(audioPath);

                if (
                    stat.size >
                    100 * 1024 * 1024
                ) {
                    throw new Error(
                        'Voice too large'
                    );
                }

                audioBuffer =
                    await fs.promises.readFile(audioPath);
                break;
            } catch (e) {
                if (attempt === 9) throw e;
                await new Promise(r => setTimeout(r, 120 + attempt * 40));
            }
        }

        let tempOut = null;
        let promptAudioPath = null;
        let promptText = null;
        try {
            let asrLang = 'auto';
            let cloneStrategy = 'zero_shot';

            try {
                const rawMeta = await redis.get(`user_meta_${TARGET_USER_ID}`);
                if (rawMeta) {
                    const meta = JSON.parse(rawMeta);
                    asrLang = meta.asrLanguage || 'auto';
                    cloneStrategy = meta.cloneStrategy || 'zero_shot';
                }
            } catch (err) {
                console.error(`[tg-client] Failed to read user_meta for samesame:`, err.message);
            }

            try {
                // Check if we already transcribed this audio (cache hit)
                if (audioBuffer) {
                    const hash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
                    
                    const cached = await redis.get(`asr:${hash}:${asrLang}`);
                    if (cached) {
                        try {
                            const parsed = JSON.parse(cached);
                            if (parsed && parsed.text) {
                                promptText = parsed.text;
                                console.log(`[samesame] Found cached transcription to use as promptText: ${promptText.substring(0, 50)}...`);
                            }
                        } catch (e) {
                            console.error('[samesame] Error parsing cached ASR for promptText:', e.message);
                        }
                    }
                }
            } catch (err) {}

            if (cloneStrategy === 'off') {
                console.log(`[samesame] clone_strategy is 'off', sending text only`);
                await safeSendMessage(client, chatId, message.id, `📝 ${cleanText}`);
                if (statusAction) statusAction.stop();
                return;
            }

            if (cloneStrategy === 'cross_lingual') {
                console.log(`[samesame] clone_strategy is 'cross_lingual', forcing promptText to null`);
                promptText = null;
            }

            console.log('[samesame] calling cloneVoiceWithSamesame with text len=', cleanText.length, 'mime=', mime);

            // Call the shared SAMESAME service (pass correct mime for voice vs video note)
            console.time(`[tg-client] SAMESAME clone request msg ${message.id}`);
            const { outputPath, audioBuffer: resultBuffer, model: usedModel, duration: samesameDuration } = await cloneVoiceWithSamesame({
                sourceAudioPath: audioPath,
                text: cleanText,
                promptText,
                language,
                userId: senderId,
                sourceMimeType: mime,
                samesameSecret: process.env.SAMESAME_SECRET,
                samesameUrl: process.env.SAMESAME_URL
            });
            console.timeEnd(`[tg-client] SAMESAME clone request msg ${message.id}`);
            
            // Send the cloned voice back (as voice note)
            if (outputPath) {
                tempOut = outputPath;
                console.log(`[samesame] clone result using shared path: ${tempOut}`);
            } else if (resultBuffer) {
                tempOut = `/temporaly-media-msg/samesame-${Date.now()}.ogg`;
                fs.writeFileSync(tempOut, resultBuffer);
                console.log('[samesame] clone result buffer size:', resultBuffer.length);
            } else {
                throw new Error("No output received from SAMESAME");
            }

            console.time(`[tg-client] Send SAMESAME Voice Reply msg ${message.id}`);
            const sentMsg = await client.invoke({
                '_': 'sendMessage',
                chat_id: chatId,
                reply_to_message_id: message.id,
                input_message_content: {
                    '_': 'inputMessageVoiceNote',
                    voice_note: {
                        '_': 'inputFileLocal',
                        path: tempOut
                    },
                    caption: {
                        '_': 'formattedText',
                        text: `🤖 ${usedModel || 'Samesame'} [${cloneStrategy}] | ⏱ ${samesameDuration || '?'}s`
                    },
                    duration: 0,
                    waveform: ''
                }
            });
            console.timeEnd(`[tg-client] Send SAMESAME Voice Reply msg ${message.id}`);

            if (sentMsg && sentMsg.id) {
                botGeneratedMsgIds.add(sentMsg.id);
                pendingUploads.set(sentMsg.id, tempOut);
                tempOut = null; // Do not delete in finally block
            }
        } finally {

            if (tempOut) { try { fs.unlinkSync(tempOut); } catch (_) { } }
        }

    } catch (err) {
        console.error('[samesame] clone error:', err);
        await safeSendMessage(client, chatId, message.id, `Ошибка SAMESAME: ${err.message}`);
    } finally {
        if (statusAction) statusAction.stop();
        if (fileId) {
            try { await client.invoke({ '_': 'deleteFile', file_id: Number(fileId) }); } catch { }
        }
    }
}

export async function startTelegramClient() { await startUserClient(); }
export function stopTelegramClient() {
    if (client) { client.close(); client = null; }
}
