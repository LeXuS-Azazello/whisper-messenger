import { createClient, packSession } from './utils.js';
import { MODE, API_ID, API_HASH } from './config.js';

// Shared Map across endpoints
export const authSessions = new Map();

function getTdlibParams(dbDir) {
    return {
        "@type": "setTdlibParameters",
        "parameters": {
            "database_directory": dbDir,
            "use_message_database": true,
            "use_secret_chats": false,
            "api_id": Number(API_ID),
            "api_hash": API_HASH,
            "system_language_code": "en",
            "device_model": "Node.js TDLib Manager",
            "system_version": "Linux",
            "application_version": "1.0.0",
            "enable_storage_optimizer": true
        }
    };
}

export async function sendCode(req, res) {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ error: 'Missing phone' });
        
        const phoneClean = String(phone).trim();
        console.log(`[/send-code] TDLib Request for ${phoneClean}`);
        
        // Close existing session if any to avoid database lock
        const existing = authSessions.get(phoneClean);
        if (existing) {
            if (existing.status === 'connecting' && (Date.now() - (existing.createdAt || 0) < 10000)) {
                console.log(`[/send-code] Request already in progress for ${phoneClean}, skipping new client creation`);
                return res.json({ success: true, message: 'Code already being sent' });
            }
            if (existing.client) {
                console.log(`[/send-code] Closing existing session for ${phoneClean}`);
                try { await existing.client.close(); } catch (e) { }
            }
            authSessions.delete(phoneClean);
        }

        const client = createClient(phoneClean);
        const session = { client, phone: phoneClean, status: 'connecting', createdAt: Date.now(), responded: false };
        authSessions.set(phoneClean, session);

        client.on('error', (err) => {
            console.error(`[/send-code] TDLib client error for ${phoneClean}:`, err);
            if (!session.responded) {
                session.responded = true;
                res.status(500).json({ error: `TDLib error: ${err.message}` });
            }
        });

        client.on('updateAuthorizationState', async (update) => {
            const state = update.authorization_state;
            const type = state['@type'];
            console.log(`[/send-code] Auth state for ${phoneClean}: ${type}`);

            try {
                if (type === 'authorizationStateWaitTdlibParameters') {
                    const dbDir = `/tmp/tdlib/${phoneClean}`;
                    await client.invoke(getTdlibParams(dbDir));
                } else if (type === 'authorizationStateWaitEncryptionKey') {
                    await client.invoke({ "@type": "checkDatabaseEncryptionKey", "encryption_key": "" });
                } else if (type === 'authorizationStateWaitPhoneNumber') {
                    await client.invoke({ "@type": "setAuthenticationPhoneNumber", "phone_number": phoneClean });
                } else if (type === 'authorizationStateWaitCode') {
                    if (!session.responded) {
                        session.responded = true;
                        res.json({ success: true });
                    }
                } else if (type === 'authorizationStateWaitPassword') {
                    session.status = 'password_needed';
                    if (!session.responded) {
                        session.responded = true;
                        res.json({ success: true, requiresPassword: true });
                    }
                } else if (type === 'authorizationStateReady') {
                    session.status = 'done';
                    const me = await client.invoke({ "@type": "getMe" });
                    session.user = me;
                } else if (type === 'authorizationStateClosing' || type === 'authorizationStateClosed' || type === 'authorizationStateLoggingOut') {
                    authSessions.delete(phoneClean);
                }
            } catch (err) {
                console.error(`[/send-code] Error in state handler for ${phoneClean}:`, err);
                if (!session.responded) {
                    session.responded = true;
                    res.status(500).json({ error: err.message });
                }
            }
        });

        console.log(`[/send-code] Connecting TDLib client for ${phoneClean}...`);
        await client.connect();

        // Timeout for initial connection
        setTimeout(async () => {
            if (!session.responded) {
                session.responded = true;
                console.warn(`[/send-code] TDLib timeout for ${phoneClean}, closing client`);
                try { await client.close(); } catch (e) { }
                authSessions.delete(phoneClean);
                res.status(500).json({ error: 'TDLib timeout' });
            }
        }, 30000);

    } catch (e) { 
        console.error(`[/send-code] Error:`, e); 
        res.status(500).json({ error: e.message }); 
    }
}

export async function verifyCode(req, res) {
    try {
        const { phone, code } = req.body;
        const s = authSessions.get(phone);
        if (!s) return res.status(404).json({ error: 'Session not found' });
        
        console.log(`[/verify-code] Checking code for ${phone}`);
        await s.client.invoke({ "@type": "checkAuthenticationCode", "code": String(code) });
        
        // Wait for ready state
        for (let i=0; i<20; i++) {
            if (s.status === 'done') break;
            if (s.status === 'password_needed') return res.json({ success: false, requiresPassword: true });
            await new Promise(r => setTimeout(r, 500));
        }

        if (s.status !== 'done') {
            try { await s.client.close(); } catch (e) { }
            authSessions.delete(phone);
            return res.status(500).json({ error: 'Verification timeout' });
        }

        const packed = packSession(phone);
        const userId = s.user.id.toString();
        const firstName = s.user.first_name || "User";

        console.log(`[/verify-code] Success! User ID: ${userId}`);
        res.json({ success: true, session: packed, userId, firstName });
        
        authSessions.delete(phone);
        
        // Close the client as we no longer need it in the manager
        setTimeout(async () => {
            try { await s.client.close(); } catch (e) { }
        }, 1000);
    } catch (e) {
        console.error(`[/verify-code] Error:`, e);
        res.status(400).json({ error: e.message });
    }
}

export async function verifyPassword(req, res) {
    try {
        const { phone, password } = req.body;
        const s = authSessions.get(phone);
        if (!s) return res.status(404).json({ error: 'Session not found' });

        await s.client.invoke({ "@type": "checkAuthenticationPassword", "password": password });
        
        // Wait for ready
        for (let i=0; i<20; i++) {
            if (s.status === 'done') break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (s.status !== 'done') {
            try { await s.client.close(); } catch (e) { }
            authSessions.delete(phone);
            return res.status(500).json({ error: 'Password verification timeout' });
        }

        const packed = packSession(phone);
        res.json({ success: true, session: packed, userId: s.user.id.toString(), firstName: s.user.first_name });
        authSessions.delete(phone);
        try { await s.client.close(); } catch (e) { }
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
}

export async function qrStart(req, res) {
    let client;
    let tempId;
    try {
        tempId = `qr-${Date.now()}`;
        client = createClient(tempId);
        const session = { client, status: 'connecting', id: tempId, createdAt: Date.now(), responded: false };
        
        client.on('error', (err) => {
            console.error(`[/qr-start] TDLib client error for ${tempId}:`, err);
        });

        client.on('updateAuthorizationState', async (update) => {
            const state = update.authorization_state;
            const type = state['@type'];
            console.log(`[/qr-start] Auth state for ${tempId}: ${type}`);

            try {
                if (type === 'authorizationStateWaitTdlibParameters') {
                    await client.invoke(getTdlibParams(`/tmp/tdlib/${tempId}`));
                } else if (type === 'authorizationStateWaitEncryptionKey') {
                    await client.invoke({ "@type": "checkDatabaseEncryptionKey", "encryption_key": "" });
                } else if (type === 'authorizationStateWaitPhoneNumber') {
                    await client.invoke({ "@type": "requestQrCode" });
                } else if (type === 'authorizationStateWaitOtherDeviceConfirmation') {
                    console.log(`[/qr-start] QR Link received for ${tempId}`);
                    session.qrUrl = state.link;
                    session.status = 'qr_ready';
                } else if (type === 'authorizationStateReady') {
                    session.status = 'done';
                    session.user = await client.invoke({ "@type": "getMe" });
                } else if (type === 'authorizationStateClosing' || type === 'authorizationStateClosed') {
                    authSessions.delete(tempId);
                }
            } catch (err) {
                console.error(`[/qr-start] Error in state handler for ${tempId}:`, err);
            }
        });

        console.log(`[/qr-start] Connecting TDLib client for ${tempId}...`);
        await client.connect();

        for (let i=0; i<60; i++) {
            if (session.qrUrl) break;
            await new Promise(r => setTimeout(r, 500));
        }

        if (!session.qrUrl) {
            console.warn(`[/qr-start] QR timeout for ${tempId}, closing client`);
            session.responded = true;
            try { await client.close(); } catch (e) { }
            return res.status(500).json({ error: 'QR timeout' });
        }

        authSessions.set(tempId, session);
        res.json({ qrUrl: session.qrUrl, token: tempId });
    } catch (e) {
        if (client) try { await client.close(); } catch (err) { }
        res.status(500).json({ error: e.message });
    }
}

export async function qrCheck(req, res) {
    const { token } = req.query;
    const s = authSessions.get(token);
    if (!s) return res.json({ done: false, expired: true });

    if (s.status === 'done') {
        const packed = packSession(s.id);
        const resp = { done: true, session: packed, userId: s.user.id.toString(), firstName: s.user.first_name };
        authSessions.delete(token);
        try { await s.client.close(); } catch (e) { }
        return res.json(resp);
    }
    
    // Auto-expiry check
    if (Date.now() - (s.createdAt || 0) > 300000) { // 5 minutes
        authSessions.delete(token);
        try { await s.client.close(); } catch (e) { }
        return res.json({ done: false, expired: true });
    }

    res.json({ done: false });
}
