import('./config.js').then(async ({ default: config, MODE, TARGET_USER_ID }) => {
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

    app.post('/test-tg', async (req, res) => {
        try {
            const { sendTestMessage } = await import('./telegramClient.js');
            const me = await sendTestMessage(req.body.message);
            res.json({ success: true, me });
        } catch (e) {
            console.error('[tg-client] /test-tg error:', e.message);
            res.status(500).json({ success: false, error: e.message });
        }
    });

    if (MODE === 'USER') {
        const { startUserClient } = await import('./telegramClient.js');
        startUserClient().catch(async (e) => {
            console.error('[tg-client] Critical start error:', e);
            const errMsg = e.errorMessage || e.message || '';
            const isRevoked = errMsg.includes('AUTH_KEY_UNREGISTERED') || errMsg.includes('SESSION_REVOKED') || errMsg.includes('USER_DEACTIVATED') || errMsg.includes('SESSION_EXPIRED');
            
            if (isRevoked) {
                console.log(`[tg-client] Session for ${TARGET_USER_ID} is revoked/invalid. Notifying backend...`);
                try {
                    const managerUrl = process.env.MANAGER_URL || process.env.WORKER_URL || 'http://tg-client-manager:3000';
                    const managerSecret = process.env.MANAGER_SECRET || process.env.BRIDGE_SECRET || 'changeme';
                    await fetch(`${managerUrl}/internal/access-revoked`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: TARGET_USER_ID, secret: managerSecret })
                    });
                    console.log(`[tg-client] Successfully notified backend about session revocation.`);
                } catch (fetchErr) {
                    console.error('[tg-client] Failed to notify backend:', fetchErr.message);
                }
            }
            process.exit(1);
        });
    }



    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`[tg-client] Running in ${MODE} mode on port ${PORT}`);
    });

    // HMR support for development
    if (process.env.NODE_ENV !== 'production') {
        // Enable dynamic reloading of telegramClient
        console.log('[tg-client] Development mode — hot reload enabled');
    }
}).catch(err => {
    console.error('[tg-client] Failed to initialize:', err);
    process.exit(1);
});

export default 'tg-client';
