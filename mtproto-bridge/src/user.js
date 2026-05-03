import { Api } from 'telegram';
import { MODE, TARGET_USER_ID, TG_SESSION, WORKER_URL, SECRET } from './config.js';
import { createClient } from './utils.js';

let userClient = null;
let transcribe = null;
let globalAiConfig = null;

async function fetchGlobalConfig() {
    try {
        const workerUrl = process.env.WORKER_URL || 'https://voicemsg.net';
        const res = await fetch(`${workerUrl}/internal/config?secret=${process.env.BRIDGE_SECRET}`);
        if (res.ok) {
            globalAiConfig = await res.json();
            console.log(`[user] 🛠 Loaded global AI config: provider=${globalAiConfig.provider}`);
        }
    } catch (e) {
        console.warn(`[user] ⚠️ Failed to fetch global config:`, e.message);
    }
}

async function handleNewMessage(event) {
    const msg = event.message;
    if (!msg || !msg.isPrivate) {
        if (msg && !msg.isPrivate) console.log(`[user] Ignoring message in non-private chat ${msg.chatId}.`);
        return;
    }
    console.log(`[user] New private message from ${msg.chatId}: ${msg.message?.slice(0, 50)}...`);

    const mediaDoc = msg.media && msg.media.document;
    const isVoice = mediaDoc && mediaDoc.attributes && mediaDoc.attributes.some(a => (a.className === 'DocumentAttributeAudio' || a instanceof Api.DocumentAttributeAudio) && a.voice);
    const isVideoNote = mediaDoc && mediaDoc.attributes && mediaDoc.attributes.some(a => (a.className === 'DocumentAttributeVideo' || a instanceof Api.DocumentAttributeVideo) && a.roundMessage);

    if (!isVoice && !isVideoNote && !msg.videoNote && !msg.voice) {
        console.log(`[user] No supported media found (voice or video note).`);
        return;
    }

    try {
        const targetPeer = msg.chatId;
        const msgId = msg.id;

        console.log(`[user] 🎤 Processing voice/video from ${targetPeer} (Msg ID: ${msgId})`);

        const inputPeer = await userClient.getInputEntity(targetPeer);
        await userClient.invoke(new Api.messages.SetTyping({
            peer: inputPeer,
            action: new Api.SendMessageRecordAudioAction()
        })).catch(() => {});

        console.log(`[user] ⏳ Notifying user and downloading media...`);
        const statusMsg = await userClient.sendMessage(targetPeer, {
            message: "⏳ _Transcribing audio..._",
            replyTo: msgId,
            parseMode: 'markdown'
        });

        const buffer = await userClient.downloadMedia(msg.media, { workers: 2 });
        const mimeType = isVoice ? 'audio/ogg' : 'video/mp4';
        console.log(`[user] 💾 Downloaded ${buffer.length} bytes. Starting transcription...`);

        const { text, duration } = await transcribe(Buffer.from(buffer), mimeType, globalAiConfig);
        
        if (!text || text.trim().length === 0) {
            console.log(`[user] ❌ Transcription returned empty text.`);
            await userClient.editMessage(targetPeer, {
                message: statusMsg.id,
                text: "❌ Could not transcribe audio (empty result)."
            }).catch(e => console.error(`[user] Edit status failed:`, e.message));
            return;
        }

        console.log(`[user] ✅ Transcribed (${duration.toFixed(1)}s): "${text.slice(0, 100)}${text.length > 100 ? '...' : ''}"`);
        const timeStr = typeof duration === 'number' ? duration.toFixed(1) : duration;
        
        await userClient.editMessage(targetPeer, {
            message: statusMsg.id,
            text: `🎤 ${text}\n\n⏱️ ${timeStr}s`,
            parseMode: 'markdown'
        }).catch(e => console.error(`[user] Edit message failed:`, e.message));

        console.log(`[user] ✨ Sent transcription. Processing translation in background...`);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); 

            const workerUrl = process.env.WORKER_URL || 'https://voicemsg.net';
            console.log(`[user] 🔍 Checking translation settings for user ${TARGET_USER_ID}...`);
            const metaRes = await fetch(`${workerUrl}/internal/user-meta?userId=${TARGET_USER_ID}&secret=${process.env.BRIDGE_SECRET}`, { 
                signal: controller.signal 
            });
            clearTimeout(timeoutId);

            if (metaRes.ok) {
                const meta = await metaRes.json();
                if (meta.translateTo && meta.translateTo !== 'original' && meta.translateTo !== 'auto') {
                    console.log(`[user] 🌐 Translating to ${meta.translateTo}...`);
                    
                    const translateController = new AbortController();
                    const translateTimeoutId = setTimeout(() => translateController.abort(), 10000); 

                    const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://91.224.11.69:11434';
                    const translateRes = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        signal: translateController.signal,
                        body: JSON.stringify({
                            model: process.env.OLLAMA_MODEL || "qwen3-coder:30b",
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
                            console.log(`[user] ✅ Translation complete. Sending follow-up...`);
                            await userClient.sendMessage(targetPeer, {
                                message: `🌐 *Translation (${meta.translateTo}):*\n${translatedText}`,
                                replyTo: msgId,
                                parseMode: 'markdown'
                            });
                        }
                    } else {
                        console.error(`[user] ❌ Translation service failed: ${translateRes.status}`);
                    }
                }
            }
        } catch (e) {
            console.error(`[user] ❌ Translation/Meta error (background):`, e.message);
        }

        if (WORKER_URL) {
            fetch(`${WORKER_URL}/internal/stats`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET })
            }).catch(e => console.error('[user] Stats notify failed:', e));
        }
    } catch (e) { 
        console.error('[user] Error:', e); 
    }
}

export async function startUserClient() {
    if (!TG_SESSION) return console.error('[user] No TG_SESSION provided!');

    await fetchGlobalConfig();
    if (!transcribe) {
        const { transcribe: transcribeFunc } = await import('../transcribe.js');
        transcribe = transcribeFunc;
    }

    userClient = createClient(TG_SESSION, { connectionRetries: 5, onlyThis: true });
    await userClient.connect();

    const { NewMessage } = await import('telegram/events/index.js');
    userClient.addEventHandler(handleNewMessage, new NewMessage({ incoming: true, outgoing: false }));
    console.log(`[user] 🚀 Bridge Online for User ID: ${TARGET_USER_ID}. Listening for messages...`);
}

let accessCheckInterval = null;
export function startAccessChecker() {
    if (MODE !== 'USER' || !WORKER_URL) return;
    
    accessCheckInterval = setInterval(async () => {
        if (!userClient) return;
        try {
            await userClient.invoke(new Api.users.GetUsers({
                id: [TARGET_USER_ID]
            }));
        } catch (e) {
            const errMsg = e.errorMessage || e.message || '';
            const isBlocked = errMsg.includes('USER_IS_BLOCKED') || 
                             errMsg.includes('PEER_ID_INVALID') || 
                             errMsg.includes('INPUT_USER_DEACTIVATED') ||
                             errMsg.includes('USER_ID_INVALID');
            if (isBlocked) {
                console.log(`[access-check] User removed access: ${errMsg}, notifying manager`);
                fetch(`${process.env.WORKER_URL}/internal/access-revoked`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: TARGET_USER_ID, secret: process.env.BRIDGE_SECRET })
                }).catch(() => {});
            }
        }
    }, 60000);
}

export function getUserClient() {
    return userClient;
}
