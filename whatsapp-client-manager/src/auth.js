import { Client, RemoteAuth, Message } from 'whatsapp-web.js';
import qrcode from 'qrcode';
import { MODE, SECRET } from './config.js';
import User from './models/User.js';

// Shared Map across endpoints for ACTIVE login processes (contains non-serializable client objects)
export const authSessions = new Map();

// Map to store finished sessions for late polling
const finishedSessions = new Map();

export async function sendCode(req, res) {
    // WhatsApp Web uses QR code authentication, not code-based
    // This endpoint is kept for compatibility with the manager interface
    res.json({ 
        success: true, 
        message: 'WhatsApp Web uses QR code authentication. Use /auth/qr-start instead.' 
    });
}

export async function verifyCode(req, res) {
    // WhatsApp Web uses QR code authentication, not code-based
    // This endpoint is kept for compatibility with the manager interface
    res.json({ 
        success: true, 
        message: 'WhatsApp Web uses QR code authentication. Use /auth/qr-check instead.' 
    });
}

export async function verifyPassword(req, res) {
    // WhatsApp Web uses QR code authentication, not password-based
    // This endpoint is kept for compatibility with the manager interface
    res.json({ 
        success: true, 
        message: 'WhatsApp Web uses QR code authentication. No password verification needed.' 
    });
}

export async function qrStart(req, res) {
    try {
        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        // Close existing session if any to avoid conflicts
        const existing = authSessions.get(userId);
        if (existing) {
            if (existing.client) {
                try { await existing.client.destroy(); } catch (e) { }
            }
            authSessions.delete(userId);
        }

        // Create new WhatsApp client for QR code generation
        const client = new Client({
            authStrategy: new RemoteAuth({
                clientId: userId,
                store: {
                    save: async (data) => {
                        // Session saving is handled by RemoteAuth store
                        // We could save to Redis here if needed, but RemoteAuth handles it
                    },
                    extract: async () => {
                        // Session loading is handled by RemoteAuth store
                        return null;
                    },
                    delete: async () => {
                        // Session deletion is handled by RemoteAuth store
                    }
                }
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-root-user-downgrade'
                ]
            }
        });

        const session = { 
            client, 
            userId, 
            status: 'connecting', 
            createdAt: Date.now(), 
            responded: false 
        };
        authSessions.set(userId, session);

        client.on('qr', async (qr) => {
            try {
                const qrImage = await qrcode.toDataURL(qr);
                session.qrCode = qrImage;
                session.status = 'qr_ready';
                session.responded = true;
                
                // Notify the frontend that QR is ready
                res.json({ 
                    success: true, 
                    qrCode: qrImage 
                });
            } catch (err) {
                console.error(`[qr-start] QR Generation Error for user ${userId}:`, err);
                if (!session.responded) {
                    session.responded = true;
                    res.status(500).json({ error: 'QR Generation Failed' });
                }
            }
        });

        client.on('ready', () => {
            console.log(`[qr-start] WhatsApp client ready for user ${userId}`);
            session.status = 'ready';
            session.responded = true;
            
            // Notify frontend that authentication is complete
            // In a real implementation, we would save the session here
            // But RemoteAuth handles this automatically
        });

        client.on('authenticated', () => {
            console.log(`[qr-start] WhatsApp authenticated for user ${userId}`);
            session.status = 'authenticated';
        });

        client.on('message', async (msg) => {
            // Handle incoming messages - this would normally be forwarded to the queue
            console.log(`[qr-start] Received message from ${msg.from}: ${msg.body}`);
        });

        client.on('disconnected', (reason) => {
            console.log(`[qr-start] WhatsApp client disconnected for user ${userId}:`, reason);
            session.status = 'disconnected';
            // Clean up session
            setTimeout(() => {
                authSessions.delete(userId);
            }, 5000);
        });

        console.log(`[qr-start] Initializing WhatsApp client for user ${userId}...`);
        await client.initialize();
        
        // Set timeout for QR code scanning
        setTimeout(() => {
            if (!session.responded) {
                session.responded = true;
                console.warn(`[qr-start] QR timeout for user ${userId}`);
                try { client.destroy(); } catch (e) { }
                authSessions.delete(userId);
                // Note: We don't send a response here as we may have already sent the QR code
            }
        }, 60000); // 1 minute timeout for QR code scanning

    } catch (e) {
        console.error('[qr-start] Error:', e);
        res.status(500).json({ error: e.message });
    }
}

export async function qrCheck(req, res) {
    const { userId } = req.query;
    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    // Check if it's already finished
    if (finishedSessions.has(userId)) {
        return res.json(finishedSessions.get(userId));
    }

    const session = authSessions.get(userId);
    if (!session) {
        return res.json({ done: false, expired: true });
    }

    if (session.status === 'ready' || session.status === 'authenticated') {
        // Authentication successful
        console.log(`[qr-check] WhatsApp authentication successful for user ${userId}`);
        
        // In a real implementation, we would save session data here
        // But RemoteAuth handles session persistence automatically
        
        const resp = { 
            done: true, 
            userId,
            status: session.status
        };

        // Cache for 10 seconds to handle late polling
        finishedSessions.set(userId, resp);
        setTimeout(() => finishedSessions.delete(userId), 10000);
        
        // Clean up the active session
        authSessions.delete(userId);
        
        return res.json(resp);
    }

    // Auto-expiry check
    if (Date.now() - (session.createdAt || 0) > 300000) { // 5 minutes
        console.log(`[qr-check] QR timeout for user ${userId}`);
        authSessions.delete(userId);
        try { session.client.destroy(); } catch (e) { }
        return res.json({ done: false, expired: true });
    }

    res.json({ done: false });
}

export async function accessRevoked(req, res) {
    try {
        const { userId } = req.body;
        const secret = req.body.secret;
        
        if (secret !== SECRET) {
            return res.status(401).json({ error: 'Invalid secret' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        console.log(`[access-revoked] Access revoked requested for user ${userId}`);

        // Stop the WhatsApp client if it's running
        const session = authSessions.get(userId);
        if (session && session.client) {
            try {
                await session.client.destroy();
                console.log(`[access-revoked] WhatsApp client destroyed for user ${userId}`);
            } catch (e) {
                console.error(`[access-revoked] Error destroying WhatsApp client for user ${userId}:`, e);
            }
        }

        // Remove from active sessions
        authSessions.delete(userId);
        
        // Note: Session data is handled by RemoteAuth store, so we don't need to manually delete from Redis
        // In a production environment, you might want to clear the RemoteAuth store data
        
        res.json({ success: true });
    } catch (e) {
        console.error('[access-revoked] Error:', e);
        res.status(500).json({ error: e.message });
    }
}