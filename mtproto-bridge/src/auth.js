import { Api } from 'telegram';
import { MODE, API_ID, API_HASH } from './config.js';
import { createClient } from './utils.js';

// Shared Map across endpoints
export const authSessions = new Map();

export async function sendCode(req, res) {
    try {
        const { phone } = req.body;
        if (!phone) {
            console.error(`[/send-code] Missing phone in request body`);
            return res.status(400).json({ error: 'Missing phone' });
        }
        const phoneClean = String(phone).trim();
        console.log(`[/send-code] Raw Request: ${phoneClean}`);
        
        const client = createClient('');
        await client.connect();
        
        console.log(`[/send-code] Invoking Api.auth.SendCode...`);
        const result = await client.invoke(new Api.auth.SendCode({
            phoneNumber: phoneClean,
            apiId: Number(API_ID),
            apiHash: API_HASH,
            settings: new Api.CodeSettings({
                allowFlashcall: false,
                currentNumber: true,
                allowAppHash: true,
            })
        }));

        console.log(`[/send-code] Result:`, result);
        const { phoneCodeHash } = result;
        
        authSessions.set(phoneClean, { client, session: client.session, phoneCodeHash });
        res.json({ success: true, phoneCodeHash });
    } catch (e) { 
        console.error(`[/send-code] CRITICAL ERROR:`, e); 
        res.status(500).json({ error: e.message, stack: e.stack }); 
    }
}

export async function verifyCode(req, res) {
    try {
        const { phone, code } = req.body;
        console.log(`[/verify-code] Checking code ${code} for ${phone}`);
        const s = authSessions.get(phone);
        if (!s) {
            console.error(`[/verify-code] No session for ${phone}. Available keys:`, [...authSessions.keys()]);
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const user = await s.client.invoke(new Api.auth.SignIn({
            phoneNumber: String(phone),
            phoneCodeHash: s.phoneCodeHash,
            phoneCode: String(code)
        }));
        
        console.log(`[/verify-code] SignIn Success! User ID:`, user.user?.id || user.id);
        const sessionStr = s.session.save();
        
        try { 
            await s.client.disconnect(); 
            console.log(`[/verify-code] Manager client disconnected for ${phone}`);
        } catch (e) {
            console.warn(`[/verify-code] Disconnect error (ignoring):`, e.message);
        }
        const telegramUser = user.user || user;
        const firstName = telegramUser.firstName || "Telegram User";
        const userId = telegramUser.id?.toString() || "0";
        
        console.log(`[/verify-code] SUCCESS! Welcome ${firstName} (ID: ${userId})`);
        res.json({ success: true, session: sessionStr, userId, firstName });
    } catch (e) {
        if (e.message?.includes('SESSION_PASSWORD_NEEDED')) {
            console.log(`[/verify-code] 2FA required for ${phone}`);
            return res.json({ success: false, requiresPassword: true });
        }
        
        // Handle common Telegram API errors like invalid codes gracefully
        if (e.message?.includes('PHONE_CODE_INVALID') || e.message?.includes('PHONE_CODE_EXPIRED') || e.errorMessage) {
            console.warn(`[/verify-code] Telegram API Error for ${phone}: ${e.errorMessage || e.message}`);
            return res.status(400).json({ error: e.errorMessage || e.message });
        }

        console.error(`[/verify-code] CRITICAL ERROR:`, e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
}

export async function verifyPassword(req, res) {
    try {
        const { phone, password, token } = req.body;
        const key = phone || token; 
        console.log(`[/verify-password] Checking password for ${key}`);
        const s = authSessions.get(key);
        if (!s) return res.status(404).json({ error: 'Session not found' });

        const user = await s.client.signIn({ password: async () => password });
        const sessionStr = s.session.save();
        
        try { 
            await s.client.disconnect(); 
            console.log(`[/verify-password] Manager client disconnected for ${key}`);
        } catch (e) {
            console.warn(`[/verify-password] Disconnect error (ignoring):`, e.message);
        }
        authSessions.delete(key);

        console.log(`[/verify-password] SUCCESS! Welcome ${user.firstName} (ID: ${user.id})`);
        res.json({ success: true, session: sessionStr, userId: user.id.toString(), firstName: user.firstName });
    } catch (e) {
        console.error(`[/verify-password] error:`, e);
        res.status(400).json({ error: e.message });
    }
}

export async function qrStart(req, res) {
    try {
        if (MODE !== 'MANAGER') return res.status(400).send('Not manager');
        const client = createClient('', { retries: 3 });
        await client.connect();
        let qrData = null;
        
        console.log(`[qr-start] Initiating QR code login...`);
        const loginPromise = client.signInUserWithQrCode(
            { apiId: API_ID, apiHash: API_HASH }, 
            {
                qrCode: async (code) => {
                    const b64 = code.token.toString('base64url');
                    qrData = { qrUrl: `tg://login?token=${b64}`, token: b64 };
                    console.log(`[qr-start] QR generated: ${qrData.qrUrl}`);
                },
                password: async () => {
                    console.log(`[qr-start] 2FA Password required`);
                    const s = authSessions.get(qrData?.token);
                    if (s) s.status = 'password_needed';
                    return ""; 
                },
                onError: (err) => {
                    console.error("[qr-start] Error in sign-in callback:", err.message);
                }
            }
        );

        for (let i=0; i<20; i++) { if (qrData) break; await new Promise(r => setTimeout(r, 500)); }
        if (!qrData) return res.status(500).json({ error: 'QR timeout' });
        
        authSessions.set(qrData.token, { client, session: client.session, status: 'pending' });
        
        loginPromise.then(user => {
            const s = authSessions.get(qrData.token);
            if (s) { 
                s.status = 'done'; 
                s.user = user; 
                s.sessionStr = s.client.session.save(); 
                s.client.disconnect().catch(() => {});
            }
        }).catch(e => { 
            const s = authSessions.get(qrData.token);
            if (s && s.status === 'password_needed') return;
            authSessions.delete(qrData.token); 
        });
        
        res.json(qrData);
    } catch (e) {
        console.error(`[/qr-start] Error:`, e);
        res.status(500).json({ error: e.message });
    }
}

export async function qrCheck(req, res) {
    const s = authSessions.get(req.query.token);
    if (!s) return res.json({ done: false, expired: true });
    
    if (s.status === 'done') {
        const resp = { done: true, session: s.sessionStr, userId: s.user.id.toString(), firstName: s.user.firstName };
        authSessions.delete(req.query.token);
        return res.json(resp);
    }
    
    if (s.status === 'password_needed') {
        return res.json({ done: false, requiresPassword: true });
    }
    
    res.json({ done: false });
}
