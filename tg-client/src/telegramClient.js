import { createClient, getLangLabel, logError } from './utils.js';
import translate from 'google-translate-api-x';
import {
    TARGET_USER_ID,
    redis
} from './config.js';
import { downloadTelegramFile, handleFileUpdate } from './downloader.js';
import { transcribePath, splitTextIntoChunks } from './transcriber.js';
import { safeSendMessage, deleteMessage, updateManagerStats } from './messenger.js';
import { isSamesameRequest, parseSamesameRequest, cloneVoiceWithSamesame } from '../shared/samesame.js';

import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

// Trim audio to maxSec seconds using ffmpeg. Returns a Buffer of the trimmed OGG audio.
async function trimAudioTo28s(inputBuffer, inputMime) {
    const ext = inputMime === 'video/mp4' ? '.mp4' : '.ogg';
    const tmpIn  = `/tmp/samesame_in_${Date.now()}${ext}`;
    const tmpOut = `/tmp/samesame_trim_${Date.now()}.ogg`;
    try {
        fs.writeFileSync(tmpIn, inputBuffer);
        // extract audio, trim to 28s, re-encode as opus ogg
        await execFileAsync('ffmpeg', [
            '-y', '-i', tmpIn,
            '-t', '28',
            '-vn', '-c:a', 'libopus', '-b:a', '32k',
            tmpOut
        ]);
        const trimmed = fs.readFileSync(tmpOut);
        return trimmed;
    } finally {
        try { fs.unlinkSync(tmpIn);  } catch (_) {}
        try { fs.unlinkSync(tmpOut); } catch (_) {}
    }
}


let client = null;
let myUserId = null;
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;

export const pendingUploads = new Map();
export const botGeneratedMsgIds = new Set();

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
        const text = message.content.text?.text || '';

        // Handle /lang command from the target user
        const isSelfChat = myUserId && Number(chat_id) === Number(myUserId);
        const myId = myUserId || (TARGET_USER_ID ? Number(TARGET_USER_ID) : null);
        if (message.is_outgoing || isSelfChat || Number(message.sender_id?.user_id) === myId) {
            if (text.startsWith('/lang')) {
                const parts = text.split(/\s+/);
                const langOpt = parts[1] ? parts[1].toLowerCase() : 'auto';

                await redis.set(`translate_lang_${TARGET_USER_ID}`, langOpt);

                let reply = `✅ Translation target set to: ${langOpt}`;
                if (langOpt === 'off') reply = `✅ Translation disabled.`;
                else if (langOpt === 'auto') reply = `✅ Translation set to auto (Telegram system language).`;

                await safeSendMessage(client, chat_id, message.id, reply);
                return;
            }
        }

        handleSamesameReplyIfNeeded(message).catch(err => {
            console.error('[samesame] Failed to handle possible SAMESAME request:', err.message);
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
        let filePath = null, statusMessage = null;
        try {
            const statusText = type === 'messageVideoNote'
                ? '📹 Transcribing circle video message...'
                : '🎤 Transcribing voice message...';
            statusMessage = await safeSendMessage(client, chat_id, message_id, statusText);

            console.time(`[tg-client] Download msg ${message_id}`);
            const downloadStart = Date.now();
            const file = await downloadTelegramFile(client, file_id, mime_type);
            console.timeEnd(`[tg-client] Download msg ${message_id}`);
            const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(1);
            filePath = file.local.path;
            if (!filePath) throw new Error('File download failed: no path');

            // Just detect language (no translation for now)
            console.time(`[tg-client] Transcribe msg ${message_id}`);
            const transcribeStart = Date.now();

            const result = await transcribePath(
                filePath,
                mime_type,
                'auto'
            );
            console.timeEnd(`[tg-client] Transcribe msg ${message_id}`);

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
                    let targetLang = await redis.get(`translate_lang_${TARGET_USER_ID}`);
                    if (!targetLang) {
                        try {
                            const rawMeta = await redis.get(`user_meta_${TARGET_USER_ID}`);
                            if (rawMeta) {
                                const meta = JSON.parse(rawMeta);
                                targetLang = meta.preferredTranslationLanguage || meta.preferred_translation_lang || null;
                            }
                        } catch (err) {
                            console.error(`[tg-client] Failed to read user_meta for translation:`, err.message);
                        }
                    }
                    if (!targetLang) targetLang = 'auto'; // Default

                    if (targetLang !== 'off') {
                        if (targetLang === 'auto') {
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
                            const transResult = await translate(originalText, { to: targetLang });
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
        } finally {
            if (statusMessage) await deleteMessage(client, chat_id, statusMessage.id);
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
    // console.log('[samesame] handleSamesameReplyIfNeeded called for text message', {
    //     hasReplyTo: !!(message?.reply_to_message_id || message?.reply_to?.message_id || message?.replyTo?.message_id),
    //     textPreview: (message?.content?.text?.text || '').substring(0, 60),
    //     isOutgoing: message?.is_outgoing,
    //     chatId: message?.chat_id
    // });

    if (!message || !message.content || message.content['_'] !== 'messageText') return;

    const text = message.content.text?.text || '';
    if (!isSamesameRequest(text)) return;

    let replyToId = message.reply_to_message_id || message.reply_to?.message_id || message.replyTo?.message_id;
    if (!replyToId) {
        console.log('[samesame] no reply_to_message_id in any known location, skipping');
        return;
    }

    const chatId = message.chat_id;
    const { text: cleanText, language } = parseSamesameRequest(text);
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
        console.log('[samesame] replied message fetched, type=', repliedType);

        let fileId = null;
        let mime = 'audio/ogg';

        if (repliedType === 'messageVoiceNote') {
            fileId = replied.content.voice_note?.voice?.id;
        } else if (repliedType === 'messageVideoNote') {
            fileId = replied.content.video_note?.video?.id;
            mime = 'video/mp4';
        }

        console.log('[samesame] extracted fileId=', fileId, 'mime=', mime);

        if (!fileId) {
            await safeSendMessage(client, chatId, message.id, 'Нужно ответить на голосовое сообщение или кружок.');
            return;
        }

        // Download the original voice
        const statusMsg = await safeSendMessage(client, chatId, message.id, '🎤 Клонирую голос... (SAMESAME)');
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
                audioBuffer = fs.readFileSync(audioPath);
                break;
            } catch (e) {
                if (attempt === 9) throw e;
                await new Promise(r => setTimeout(r, 120 + attempt * 40));
            }
        }

        let tempOut = null;
        try {

            console.log('[samesame] calling cloneVoiceWithSamesame with text len=', cleanText.length, 'mime=', mime);

            // CosyVoice rejects prompt audio longer than 30s — trim to 28s via ffmpeg
            let promptBuffer = audioBuffer;
            try {
                promptBuffer = await trimAudioTo28s(audioBuffer, mime);
                console.log(`[samesame] Trimmed prompt audio to 28s (original=${audioBuffer.length}B, trimmed=${promptBuffer.length}B)`);
            } catch (trimErr) {
                console.warn('[samesame] Could not trim audio, using original:', trimErr.message);
            }

            // Call the shared SAMESAME service (pass correct mime for voice vs video note)
            console.time(`[tg-client] SAMESAME clone request msg ${message.id}`);
            const { audioBuffer: resultBuffer } = await cloneVoiceWithSamesame({
                sourceAudioBuffer: promptBuffer,
                text: cleanText,
                language,
                sourceMimeType: 'audio/ogg',  // always ogg after ffmpeg trim
                samesameSecret: process.env.SAMESAME_SECRET,
                samesameUrl: process.env.SAMESAME_URL
            });
            console.timeEnd(`[tg-client] SAMESAME clone request msg ${message.id}`);
            console.log('[samesame] clone result buffer size:', resultBuffer.length);

            // Send the cloned voice back (as voice note)
            tempOut = `/tmp/samesame-${Date.now()}.ogg`;
            fs.writeFileSync(tempOut, resultBuffer);

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
            if (statusMsg) await deleteMessage(client, chatId, statusMsg.id);
        }

    } catch (err) {
        console.error('[samesame] clone error:', err);
        await safeSendMessage(client, chatId, message.id, `Ошибка SAMESAME: ${err.message}`);
    }
}

export async function startTelegramClient() { await startUserClient(); }
export function stopTelegramClient() {
    if (client) { client.close(); client = null; }
}
