import('./config.js').then(async ({ default: config, MODE, TARGET_USER_ID }) => {
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ mode: MODE, alive: true, userId: TARGET_USER_ID || null });
    });

    app.get('/check-access', async (req, res) => {
        const { getUserClient } = await import('./telegramClient.js');
        const userClient = getUserClient();
        if (!userClient) return res.json({ accessible: false, error: 'No client' });

        try {
            const { Api } = await import('telegram');
            await userClient.invoke(new Api.users.GetUsers({ id: [TARGET_USER_ID] }));
            res.json({ accessible: true });
        } catch (e) {
            const errMsg = e.errorMessage || e.message || '';
            const isBlocked = errMsg.includes('USER_IS_BLOCKED') || errMsg.includes('PEER_ID_INVALID');
            res.json({ accessible: false, blocked: isBlocked, error: errMsg });
        }
    });

    if (MODE === 'USER') {
        const { startUserClient } = await import('./telegramClient.js');
        await startUserClient();
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
