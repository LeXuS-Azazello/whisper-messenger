import { IgApiClient } from 'instagram-private-api';
import 'dotenv/config';

const TARGET_USER_ID = process.env.TARGET_USER_ID || 'unknown';
const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER 
    || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000/v1/transcribe-base64';
const MANAGER_URL = process.env.MANAGER_URL 
    || 'http://instagram-fca-manager:3005';
const SECRET = process.env.SECRET || process.env.MANAGER_SECRET || 'changeme';

// Parse session from environment
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
ig.state.generateDevice(sessionData.username);

console.log('[IG-FCA-Client] Starting Instagram client...');

// Login
ig.account.login(sessionData.username, sessionData.password)
    .then(() => {
        console.log(`[IG-FCA-Client] Logged in successfully as ${sessionData.username}`);
        
        // Setup direct message handling
        setupDirectMessageHandler();
    })
    .catch(async (err) => {
        console.error('[IG-FCA-Client] Login failed:', err);
        await reportAccessRevoked();
        process.exit(1);
    });

function setupDirectMessageHandler() {
    console.log('[IG-FCA-Client] Setting up direct message listener...');
    
    // Use realtime client for direct messages
    const direct = ig.direct;
    
    // Start receiving messages
    ig.realtime.connect({ fireAndForgetVisit: true }).then(() => {
        console.log('[IG-FCA-Client] Realtime connected, listening for messages...');
    });
    
    ig.realtime.on('message', async (message) => {
        try {
            // Handle incoming messages
            if (message?.messages?.length > 0) {
                for (const msg of message.messages) {
                    await handleIncomingMessage(msg, direct);
                }
            }
        } catch (e) {
            console.error('[IG-FCA-Client] Error handling message:', e);
        }
    });
}

async function handleIncomingMessage(msg, direct) {
    if (!msg) return;
    
    // Check if it's a voice message (item_type can be 'media_share' or 'voice_media')
    const isVoiceMessage = msg.item_type === 'voice_media' || 
        (msg.item_type === 'media_share' && msg.voice_media);
    
    if (isVoiceMessage) {
        console.log(`[IG-FCA-Client] Received voice message from ${msg.user_id}`);
        
        const threadId = msg.thread_id || msg.thread_v2_id;
        let statusMsgId = null;
        
        try {
            // Send transcribing status
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
            // Get voice URL
            const voiceMedia = msg.voice_media || msg.media;
            const voiceUrl = voiceMedia?.download_url || voiceMedia?.url;
            if (!voiceUrl) throw new Error('No download URL');
            
            const res = await fetch(voiceUrl, {
                headers: {
                    'User-Agent': 'Instagram 297.0.0.18.118'
                }
            });
            const buffer = Buffer.from(await res.arrayBuffer());
            
            // Transcribe
            const base64Audio = buffer.toString('base64');
            const response = await fetch(WHISPER_PROVIDER, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_data: base64Audio,
                    mime_type: 'audio/ogg',
                    language: 'auto'
                }),
                signal: AbortSignal.timeout(300000)
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            const transcriptionText = data.text || '';
            
            // Unsend status message
            if (statusMsgId) {
                try {
                    await direct.unsendItem(threadId, statusMsgId);
                } catch (e) {
                    console.warn('[IG-FCA-Client] Failed to unsend status:', e.message);
                }
            }
            
            // Send transcription reply
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