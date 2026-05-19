import fcaLogin from '@vangbanlanhat/fca-unofficial';
import 'dotenv/config';

const TARGET_USER_ID = process.env.TARGET_USER_ID || 'unknown';
const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER 
    || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000/v1/transcribe-base64';
const MANAGER_URL = process.env.MANAGER_URL 
    || 'http://facebook-fca-manager:3003';
const SECRET = process.env.SECRET || process.env.MANAGER_SECRET || 'changeme';

const login = typeof fcaLogin === 'function' ? fcaLogin : (fcaLogin.default || fcaLogin);

// Extract cookies from appState to download media attachments
function getCookieString(appState) {
    try {
        const parsed = typeof appState === 'string' ? JSON.parse(appState) : appState;
        return parsed.map(c => `${c.key}=${c.value}`).join('; ');
    } catch (e) {
        console.error('[FCA-Client] Failed to generate cookie string:', e.message);
        return '';
    }
}

async function reportStats() {
    try {
        await fetch(`${MANAGER_URL}/internal/stats`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-manager-secret': SECRET
            },
            body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET }),
            signal: AbortSignal.timeout(10000),
        });
        console.log('[FCA-Client] Stats reported successfully');
    } catch (e) {
        console.warn('[FCA-Client] Failed to report stats:', e.message);
    }
}

async function reportAccessRevoked() {
    try {
        await fetch(`${MANAGER_URL}/internal/access-revoked`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-manager-secret': SECRET
            },
            body: JSON.stringify({ userId: TARGET_USER_ID, secret: SECRET }),
            signal: AbortSignal.timeout(10000),
        });
        console.log('[FCA-Client] Access revoked reported successfully');
    } catch (e) {
        console.warn('[FCA-Client] Failed to report access-revoked:', e.message);
    }
}

// Global reference to appState
const appStateStr = process.env.FB_SESSION;

if (!appStateStr) {
    console.error('[FCA-Client] No FB_SESSION provided. Exiting.');
    process.exit(1);
}

const cookieString = getCookieString(appStateStr);

// Parse appState for login
let appStateParsed;
try {
    appStateParsed = JSON.parse(appStateStr);
} catch (e) {
    console.error('[FCA-Client] Failed to parse FB_SESSION JSON:', e.message);
    process.exit(1);
}

const loginOpts = {
    logLevel: 'warn',
    forceLogin: true,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
};

console.log('[FCA-Client] Starting login with AppState...');

login({ appState: appStateParsed }, loginOpts, (err, api) => {
    if (err) {
        console.error('[FCA-Client] Login failed:', err);
        reportAccessRevoked();
        process.exit(1);
    }

    const myId = api.getCurrentUserID();
    console.log(`[FCA-Client] Logged in successfully! My Facebook User ID is ${myId}`);

    api.setOptions({ listenEvents: true, selfListen: true });

    api.listenMqtt(async (listenErr, message) => {
        if (listenErr) {
            console.error('[FCA-Client] MQTT listener error:', listenErr);
            return;
        }

        if (!message) return;

        // Process message & message_reply types
        if (message.type !== 'message' && message.type !== 'message_reply') return;

        // Only handle incoming one-to-one (private) messages from other users
        const isGroup = !!message.isGroup;
        const isFromSelf = String(message.senderID) === String(myId);
        const isPrivate = !isGroup && !isFromSelf;

        if (!isPrivate) return;

        if (message.attachments && message.attachments.length > 0) {
            for (const attachment of message.attachments) {
                const isAudio = attachment.type === 'audio' || attachment.type === 'voice_clip';
                const isVideo = attachment.type === 'video';

                // Only transcribe voice/audio or video attachments in private chats
                if (!isAudio && !isVideo) continue;

                if (isAudio || isVideo) {
                    const mediaLabel = isVideo ? 'video' : 'voice message';
                    const mediaEmoji = isVideo ? '📹' : '🎤';
                    const mimeType = isVideo ? 'video/mp4' : 'audio/ogg';

                    console.log(`[FCA-Client] Found ${mediaLabel} attachment in thread ${message.threadID} from ${message.senderID}`);
                    
                    let statusMsgId = null;
                    try {
                        // Send transcribing status message
                        statusMsgId = await new Promise((resolve, reject) => {
                            api.sendMessage(
                                { body: `${mediaEmoji} Transcribing ${mediaLabel}...` }, 
                                message.threadID, 
                                (sendErr, info) => {
                                    if (sendErr) reject(sendErr);
                                    else resolve(info.messageID);
                                },
                                message.messageID
                            );
                        });
                    } catch (statusErr) {
                        console.warn('[FCA-Client] Failed to send status message:', statusErr.message);
                    }

                    const downloadStart = Date.now();
                    let buffer;
                    try {
                        const res = await fetch(attachment.url, {
                            headers: {
                                'Cookie': cookieString,
                                'User-Agent': loginOpts.userAgent
                            }
                        });
                        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                        buffer = Buffer.from(await res.arrayBuffer());
                    } catch (downloadErr) {
                        console.error(`[FCA-Client] Failed to download ${mediaLabel} attachment:`, downloadErr.message);
                        if (statusMsgId) api.unsendMessage(statusMsgId);
                        api.sendMessage(`⚠️ Failed to download ${mediaLabel}.`, message.threadID, null, message.messageID);
                        continue;
                    }
                    const downloadDuration = ((Date.now() - downloadStart) / 1000).toFixed(1);

                    const transcribeStart = Date.now();
                    let transcriptionText = '';
                    try {
                        const base64Audio = buffer.toString('base64');
                        const response = await fetch(WHISPER_PROVIDER, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                file_data: base64Audio,
                                mime_type: mimeType,
                                language: 'auto'
                            }),
                            signal: AbortSignal.timeout(300000)
                        });
                        const data = await response.json();
                        if (data.error) throw new Error(data.error);
                        transcriptionText = data.text || '';
                    } catch (transcribeErr) {
                        console.error('[FCA-Client] Transcription error:', transcribeErr.message);
                        if (statusMsgId) api.unsendMessage(statusMsgId);
                        api.sendMessage('⚠️ Transcription failed.', message.threadID, null, message.messageID);
                        continue;
                    }
                    const transcribeDuration = ((Date.now() - transcribeStart) / 1000).toFixed(1);

                    // Unsend transcribing status message
                    if (statusMsgId) {
                        api.unsendMessage(statusMsgId);
                    }

                    if (transcriptionText.trim()) {
                        const replyText = `${mediaEmoji} ${transcriptionText.trim()}\n\n⏳${transcribeDuration}s ⬇️${downloadDuration}s`;
                        api.sendMessage(replyText, message.threadID, null, message.messageID);
                        await reportStats();
                    } else {
                        api.sendMessage(`${mediaEmoji} (Silence / unable to transcribe)`, message.threadID, null, message.messageID);
                    }
                }
            }
        }

    });
});
