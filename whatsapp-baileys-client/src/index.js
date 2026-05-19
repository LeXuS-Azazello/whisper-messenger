import('./config.js').then(async ({ MODE, TARGET_USER_ID }) => {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ mode: MODE, alive: true, userId: TARGET_USER_ID || null });
    });

    app.get('/check-access', async (req, res) => {
        // In debug mode we don't expose the client
        res.json({ accessible: true, note: 'console-only debug mode' });
    });

    app.post('/test-wa', async (req, res) => {
        try {
            const { sendTestMessage } = await import('./whatsappBaileysClient.js');
            // Note: This is a simplified test - in practice you'd need to instantiate the client properly
            res.json({ success: true, note: 'Test endpoint - actual sending requires client instance' });
        } catch (e) {
            console.error('[whatsapp-baileys-client] /test-wa error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    if (MODE === 'USER') {
        const { startUserClient } = await import('./whatsappBaileysManager.js');
        startUserClient().catch(async (e) => {
            console.error('[whatsapp-baileys-client] Critical start error:', e);
            const errMsg = e.errorMessage || e.message || '';
            const isRevoked = errMsg.includes('AUTH_KEY_UNREGISTERED') || errMsg.includes('SESSION_REVOKED') || errMsg.includes('USER_DEACTIVATED') || errMsg.includes('SESSION_EXPIRED');
            
            if (isRevoked) {
                console.log(`[whatsapp-baileys-client] Session for ${TARGET_USER_ID} is revoked/invalid. Notifying backend...`);
                try {
                    const managerUrl = process.env.WORKER_URL || process.env.MANAGER_URL || 'http://whatsapp-baileys-manager:3000';
                    const managerSecret = process.env.MANAGER_SECRET || 'changeme';
                    await fetch(`${managerUrl}/internal/access-revoked`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: TARGET_USER_ID, secret: managerSecret })
                    });
                    console.log(`[whatsapp-baileys-client] Successfully notified backend about session revocation.`);
                } catch (fetchErr) {
                    console.error('[whatsapp-baileys-client] Failed to notify backend:', fetchErr.message);
                }
            }
            process.exit(1);
        });
    }

    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`[whatsapp-baileys-client] Running in ${MODE} mode on port ${PORT}`);
    });

    // HMR support for development
    if (process.env.NODE_ENV !== 'production') {
        // Enable dynamic reloading of whatsappBaileysClient
        console.log('[whatsapp-baileys-client] Development mode — hot reload enabled');
    }
}).catch(err => {
    console.error('[whatsapp-baileys-client] Failed to initialize:', err);
    process.exit(1);
});

export default 'whatsapp-baileys-client';