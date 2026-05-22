import { createClient } from './utils.js';
import {
    TARGET_USER_ID,
    redis
} from './config.js';
import { downloadTelegramFile } from './downloader.js';
import { transcribePath, splitTextIntoChunks } from './transcriber.js';
import { safeSendMessage, deleteMessage, updateManagerStats } from './messenger.js';

import fs from 'fs';


let client = null;
let myUserId = null;
const clientStartTime = Math.floor(Date.now() / 1000);
let oldMessagesProcessed = 0;

// Telegram language_code → NLLB code for whisper-service-v2 translation
function telegramLangToNLLB(code) {
  if (!code) return 'eng_Latn';

  const normalized = code.toLowerCase();

  const map = {
    // Major
    'ru': 'rus_Cyrl',
    'en': 'eng_Latn',
    'de': 'deu_Latn',
    'fr': 'fra_Latn',
    'es': 'spa_Latn',
    'it': 'ita_Latn',
    'pt': 'por_Latn',
    'nl': 'nld_Latn',
    'pl': 'pol_Latn',
    'tr': 'tur_Latn',

    // Asian
    'th': 'tha_Thai',           // Thai
    'vi': 'vie_Latn',           // Vietnamese
    'id': 'ind_Latn',           // Indonesian
    'ms': 'msa_Latn',           // Malay
    'ja': 'jpn_Jpan',           // Japanese
    'ko': 'kor_Hang',           // Korean

    // Chinese
    'zh': 'zho_Hans',           // Chinese Simplified (default)
    'zh-hans': 'zho_Hans',
    'zh-cn': 'zho_Hans',
    'zh-hant': 'zho_Hant',      // Traditional
    'zh-tw': 'zho_Hant',
    'zh-hk': 'zho_Hant',

    // South Asian
    'hi': 'hin_Deva',           // Hindi
    'bn': 'ben_Beng',           // Bengali
    'ta': 'tam_Taml',           // Tamil
    'te': 'tel_Telu',           // Telugu
    'mr': 'mar_Deva',           // Marathi
    'gu': 'guj_Gujr',           // Gujarati
    'pa': 'pan_Guru',           // Punjabi

    // Southeast Asian
    'km': 'khm_Khmr',           // Khmer (Cambodian)
    'lo': 'lao_Laoo',           // Lao
    'my': 'mya_Mymr',           // Burmese
    'fil': 'tgl_Latn',          // Filipino/Tagalog
    'tl': 'tgl_Latn',

    // Middle East
    'ar': 'arb_Arab',           // Arabic
    'fa': 'pes_Arab',           // Persian (Farsi)
    'ur': 'urd_Arab',           // Urdu

    // Other useful
    'uk': 'ukr_Cyrl',
    'he': 'heb_Hebr',
    'el': 'ell_Grek',
    'cs': 'ces_Latn',
    'hu': 'hun_Latn',
    'sv': 'swe_Latn',
    'da': 'dan_Latn',
    'fi': 'fin_Latn',
    'no': 'nob_Latn',
  };

  return map[normalized] || 'eng_Latn'; // fallback to English
}

// Nice labels with flags (supports short codes + NLLB codes like eng_Latn, rus_Cyrl)
function getLangLabel(code) {
  if (!code) return '🌐 auto';

  const normalized = code.toLowerCase().split('_')[0];

  const map = {
    // Russian
    'ru': '🇷🇺 рус', 'rus': '🇷🇺 рус',
    // English
    'en': '🇺🇸 eng', 'eng': '🇺🇸 eng',
    // Hebrew
    'he': '🇮🇱 עבר', 'heb': '🇮🇱 עבר',
    // Ukrainian
    'uk': '🇺🇦 укр',
    // German
    'de': '🇩🇪 нем', 'deu': '🇩🇪 нем',
    // French
    'fr': '🇫🇷 фр', 'fra': '🇫🇷 фр',
    // Spanish
    'es': '🇪🇸 исп', 'spa': '🇪🇸 исп',
    // Thai
    'th': '🇹🇭 тай',
    // Chinese
    'zh': '🇨🇳 кит', 'zho': '🇨🇳 кит',
    // Japanese
    'ja': '🇯🇵 яп', 'jpn': '🇯🇵 яп',
    // Korean
    'ko': '🇰🇷 кор', 'kor': '🇰🇷 кор',
    // Arabic
    'ar': '🇸🇦 ар', 'arb': '🇸🇦 ар',
    // Vietnamese
    'vi': '🇻🇳 вьет',
    // Indonesian
    'id': '🇮🇩 инд',
    // Turkish
    'tr': '🇹🇷 тур',
    // Auto / unknown
    'auto': '🌐 auto',
  };

  return map[normalized] || `🌐 ${normalized}`;
}

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

    if (type === 'messageVoiceNote' || type === 'messageVideoNote') {
        incomingQueue.push(message);
        processIncomingQueue();
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
            } catch (e) {}

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

            const originalText   = (result.text || '').trim();
            const detectedLang   = result.language || 'unknown';
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

export async function startTelegramClient() { await startUserClient(); }
export function stopTelegramClient() {
    if (client) { client.close(); client = null; }
}
