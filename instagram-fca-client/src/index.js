import { IgApiClient } from 'instagram-private-api';
import { getPreferredTranslationLang, reportClientStatus } from '../shared/redis.js';

const TARGET_USER_ID = process.env.TARGET_USER_ID || 'unknown';
let WHISPER_PROVIDER = process.env.WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
if (WHISPER_PROVIDER === 'whisper-turbo' || WHISPER_PROVIDER === 'whisper-service-v2') {
    WHISPER_PROVIDER = 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
} else if (!WHISPER_PROVIDER.startsWith('http://') && !WHISPER_PROVIDER.startsWith('https://')) {
    WHISPER_PROVIDER = 'http://' + WHISPER_PROVIDER;
}
WHISPER_PROVIDER = WHISPER_PROVIDER.replace(/\/$/, '') + '/v1/transcribe-base64';
const MANAGER_URL = process.env.MANAGER_URL 
    || 'http://instagram-fca-manager:3005';
const SECRET = process.env.SECRET || process.env.MANAGER_SECRET || 'changeme';

// Parse session from environment (can be {appState, username, pk} or {username, password})
const igSessionStr = process.env.IG_SESSION;

if (!igSessionStr) {
    console.error('[IG-FCA-Client] No IG_SESSION provided. Exiting.');
    process.exit(1);
}

let sessionData;
try {
    sessionData = JSON.parse(igSessionStr);
} catch (e) {
    console.error('[IG-FCA-Client] Failed to parse IG_SESSION JSON:', e.message);
    process.exit(1);
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
        console.log('[IG-FCA-Client] Stats reported successfully');
    } catch (e) {
        console.warn('[IG-FCA-Client] Failed to report stats:', e.message);
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
        console.log('[IG-FCA-Client] Access revoked reported successfully');
    } catch (e) {
        console.warn('[IG-FCA-Client] Failed to report access-revoked:', e.message);
    }
}

const ig = new IgApiClient();

console.log('[IG-FCA-Client] Starting Instagram client...');

async function initializeInstagram() {
    try {
        // Preferred: AppState (cookies only) - stable, no credential login
        if (sessionData.appState && Array.isArray(sessionData.appState)) {
            console.log('[IG-FCA-Client] Using saved AppState (cookies)...');
            ig.state.generateDevice(sessionData.username || 'instagram-user');
            await ig.state.deserializeCookieJar(sessionData.appState);

            // Verify session
            const currentUser = await ig.account.currentUser();
            console.log(`[IG-FCA-Client] AppState valid. Logged in as @${currentUser.username} (pk=${currentUser.pk})`);
        } 
        // Fallback: username + password (risky, may trigger challenges)
        else if (sessionData.username && sessionData.password) {
            console.log('[IG-FCA-Client] Using username/password login (not recommended for production)...');
            ig.state.generateDevice(sessionData.username);
            await ig.account.login(sessionData.username, sessionData.password);
            console.log(`[IG-FCA-Client] Credential login successful as ${sessionData.username}`);
        } else {
            throw new Error('Invalid IG_SESSION: need either {appState: [...]} or {username, password}');
        }

        reportClientStatus('ig', TARGET_USER_ID, 'ready');
        setupDirectMessageHandler();
    } catch (err) {
        console.error('[IG-FCA-Client] Instagram initialization failed:', err);
        reportClientStatus('ig', TARGET_USER_ID, 'revoked');
        await reportAccessRevoked();
        process.exit(1);
    }
}

initializeInstagram();

let lastCheckedTimestamp = Date.now() * 1000;
const processedMessageIds = new Set();

async function pollDirectMessages() {
    try {
        const inboxFeed = ig.feed.directInbox();
        const threads = await inboxFeed.items();

        for (const thread of threads) {
            const threadId = thread.thread_v2_id || thread.thread_id;
            for (const item of thread.items) {
                if (item.timestamp < lastCheckedTimestamp || processedMessageIds.has(item.item_id)) {
                    continue;
                }
                processedMessageIds.add(item.item_id);

                if (String(item.user_id) === String(ig.state.cookieUserId)) continue;

                await handleIncomingMessage(item, ig.direct, threadId);
            }
        }
    } catch (e) {
        console.error('[IG-FCA-Client] Polling error:', e.message);
    }
}

function setupDirectMessageHandler() {
    console.log('[IG-FCA-Client] Setting up direct message listener (polling every 10s)...');
    setInterval(pollDirectMessages, 10000);
    pollDirectMessages();
}

async function handleIncomingMessage(msg, direct, threadIdParam) {
    if (!msg) return;

    const isVoiceMessage = msg.item_type === 'voice_media' || 
        (msg.item_type === 'media_share' && msg.voice_media);

    if (isVoiceMessage) {
        console.log(`[IG-FCA-Client] Received voice message from ${msg.user_id}`);

        const threadId = threadIdParam || msg.thread_id || msg.thread_v2_id;
        let statusMsgId = null;

        try {
            const statusMsg = await direct.send({
                item_type: 'text',
                text: '🎤 Transcribing voice message...',
                thread_id: threadId
            });
            statusMsgId = statusMsg?.items?.[0]?.item_id;
        } catch (e) {
            console.warn('[IG-FCA-Client] Failed to send status:', e.message);
        }

        try {
            const voiceMedia = msg.voice_media || msg.media;
            const voiceUrl = voiceMedia?.download_url || voiceMedia?.url;
            if (!voiceUrl) throw new Error('No download URL');

            const res = await fetch(voiceUrl, {
                headers: { 'User-Agent': 'Instagram 297.0.0.18.118' }
            });
            const buffer = Buffer.from(await res.arrayBuffer());

            const base64Audio = buffer.toString('base64');
            let language = 'auto';
            try {
                const preferred = await getPreferredTranslationLang(TARGET_USER_ID);
                if (preferred) language = preferred;
            } catch {}

            const response = await fetch(WHISPER_PROVIDER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_data: base64Audio,
                    mime_type: 'audio/ogg',
                    language
                }),
                signal: AbortSignal.timeout(300000)
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            const transcriptionText = data.text || '';

            if (statusMsgId) {
                try { await direct.unsendItem(threadId, statusMsgId); } catch (e) {}
            }

            const replyText = transcriptionText.trim()
                ? `🎤 ${transcriptionText.trim()}`
                : '🎤 (Silence / unable to transcribe)';

            await direct.send({
                item_type: 'text',
                text: replyText,
                thread_id: threadId,
                reply_to_item_id: msg.item_id
            });

            await reportStats();
        } catch (err) {
            console.error('[IG-FCA-Client] Error processing voice message:', err);
            if (statusMsgId) {
                try { await direct.unsendItem(threadId, statusMsgId); } catch (e) {}
            }
            await direct.send({
                item_type: 'text',
                text: '⚠️ Failed to transcribe voice message.',
                thread_id: threadId,
                reply_to_item_id: msg.item_id
            });
        }
    }
}
