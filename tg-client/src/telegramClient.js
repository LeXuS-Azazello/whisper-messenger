import { Api } from 'telegram';
import { TARGET_USER_ID, TG_SESSION, WORKER_URL, BRIDGE_SECRET, OLLAMA_BASE_URL, OLLAMA_MODEL } from './config.js';

let userClient = null;
let globalAiConfig = null;

async function fetchGlobalConfig() {
    try {
        const workerUrl = WORKER_URL || 'https://voicemsg.net';
        const res = await fetch(`${workerUrl}/internal/config?secret=${BRIDGE_SECRET}`);
        if (res.ok) {
            globalAiConfig = await res.json();
            console.log(`[tg-client] Loaded global AI config: provider=${globalAiConfig.provider}`);
        }
    } catch (e) {
        console.warn(`[tg-client] ⚠️ Failed to fetch global config:`, e.message);
    }
}

async function handleNewMessage(event) {
    const msg = event.message;
    if (!msg || !msg.isPrivate) {
        if (msg && !msg.isPrivate) console.log(`[tg-client] Ignoring message in non-private chat ${msg.chatId}.`);
        return;
    }
    console.log(`[tg-client] New private message from ${msg.chatId}: ${msg.message?.slice(0, 50)}...`);

    const mediaDoc = msg.media && msg.media.document;
    const isVoice = mediaDoc && mediaDoc.attributes && mediaDoc.attributes.some(a => (a.className === 'DocumentAttributeAudio' || a instanceof Api.DocumentAttributeAudio) && a.voice);
    const isVideoNote = mediaDoc && mediaDoc.attributes && mediaDoc.attributes.some(a => (a.className === 'DocumentAttributeVideo' || a instanceof Api.DocumentAttributeVideo) && a.roundMessage);

    if (!isVoice && !isVideoNote && !msg.videoNote && !msg.voice) {
        console.log(`[tg-client] No supported media found (voice or video note).`);
        return;
    }

    try {
        const targetPeer = msg.chatId;
        const msgId = msg.id;

        console.log(`[tg-client] 🎤 Processing voice/video from ${targetPeer} (Msg ID: ${msgId})`);

        const inputPeer = await userClient.getInputEntity(targetPeer);
        await userClient.invoke(new Api.messages.SetTyping({
            peer: inputPeer,
            action: new Api.SendMessageRecordAudioAction()
        })).catch(() => { });

        console.log(`[tg-client] ⏳ Notifying user and downloading media...`);
        const statusMsg = await userClient.sendMessage(targetPeer, {
            message: "⏳ _Transcribing audio..._",
            replyTo: msgId,
            parseMode: 'markdown'
        });

        const buffer = await userClient.downloadMedia(msg.media, { workers: 2 });
        const mimeType = isVoice ? 'audio/ogg' : 'video/mp4';
        console.log(`[tg-client] 💾 Downloaded ${buffer.length} bytes. Starting transcription...`);

        const { text, duration } = await transcribeAudio(Buffer.from(buffer), mimeType);

        if (!text || text.trim().length === 0) {
            console.log(`[tg-client] ❌ Transcription returned empty text.`);
            await userClient.editMessage(targetPeer, {
                message: statusMsg.id,
                text: "❌ Could not transcribe audio (empty result)."
            }).catch(e => console.error(`[tg-client] Edit status failed:`, e.message));
            return;
        }

        console.log(`[tg-client] ✅ Transcribed (${duration.toFixed(1)}s): "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
        const timeStr = typeof duration === 'number' ? duration.toFixed(1) : duration;

        await userClient.editMessage(targetPeer, {
            message: statusMsg.id,
            text: `🎤 ${text}\n\n⏱️ ${timeStr}s`,
            parseMode: 'markdown'
        }).catch(e => console.error(`[tg-client] Edit message failed:`, e.message));

        console.log(`[tg-client] ✨ Sent transcription. Processing translation in background...`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const workerUrl = WORKER_URL || 'https://voicemsg.net';
            console.log(`[tg-client] 🔍 Checking translation settings for user ${TARGET_USER_ID}...`);
            const metaRes = await fetch(`${workerUrl}/internal/user-meta?userId=${TARGET_USER_ID}&secret=${BRIDGE_SECRET}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (metaRes.ok) {
                const meta = await metaRes.json();
                if (meta.translateTo && meta.translateTo !== 'original' && meta.translateTo !== 'auto') {
                    console.log(`[tg-client] 🌐 Translating to ${meta.translateTo}...`);

                    const translateController = new AbortController();
                    const translateTimeoutId = setTimeout(() => translateController.abort(), 10000);

                    const ollamaUrl = OLLAMA_BASE_URL || 'http://qwen3-asr:11434';
                    const translateRes = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: translateController.signal,
                        body: JSON.stringify({
                            model: OLLAMA_MODEL || 'qwen3:latest',
                            messages: [
                                { role: "system", content: `Translate the following text to ${meta.translateTo}. Output only the translated text, nothing else. If the text is already in ${meta.translateTo}, return it as is.` },
                                { role: "user", content: text }
                            ],
                            stream: false
                        })
                    });
                    clearTimeout(translateTimeoutId);

                    if (translateRes.ok) {
                        const tData = await translateRes.json();
                        const translatedText = tData.choices?.[0]?.message?.content;
                        if (translatedText && translatedText.trim() !== text.trim()) {
                            console.log(`[tg-client] ✅ Translation complete. Sending follow-up...`);
                            await userClient.sendMessage(targetPeer, {
                                message: `🌐 *Translation (${meta.translateTo}):*\n${translatedText}`,
                                replyTo: msgId,
                                parseMode: 'markdown'
                            });
                        }
                    }
                }
            }
        } catch (e) {
            console.error(`[tg-client] ❌ Translation/Meta error (background):`, e.message);
        }

        if (WORKER_URL) {
            fetch(`${WORKER_URL}/internal/stats`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: TARGET_USER_ID, secret: BRIDGE_SECRET })
            }).catch(e => console.error('[tg-client] Stats notify failed:', e));
        }
    } catch (e) {
        console.error('[tg-client] Error:', e);
    }
}

async function transcribeAudio(audioBuffer, mimeType) {
    const qwenUrl = OLLAMA_BASE_URL || 'http://qwen3-asr:11434';
    const startTime = Date.now();

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'qwen3-asr');
    formData.append('language', 'auto');

    console.log(`[tg-client] Transcribing with Qwen3-ASR via ${qwenUrl}`);

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
    if (!TG_SESSION) return console.error('[tg-client] No TG_SESSION provided!');

    await fetchGlobalConfig();

    const { StringSession } = await import('telegram/sessions/index.js');
    const session = new StringSession(TG_SESSION || '');
    userClient = new TelegramClient(session, TG_API_ID, TG_API_HASH, {
        connectionRetries: 5,
        deviceModel: DEVICE_MODEL,
        appVersion: APP_VERSION,
        systemVersion: SYSTEM_VERSION,
        useIPV6: false
    });
    await userClient.connect();

    const { NewMessage } = await import('telegram/events/index.js');
    userClient.addEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: false }));
    console.log(`[tg-client] 🚀 Client Online for User ID: ${TARGET_USER_ID}. Listening for voice messages...`);
}

export function getUserClient() {
    return userClient;
}
