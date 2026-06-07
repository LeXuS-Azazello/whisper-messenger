import { IgApiClient } from 'instagram-private-api';
import { redis } from './config.js';
import User from './object-object-models/User.js';
import MessengerSession from './object-object-models/MessengerSession.js';
import { spawnPod } from './k8s.js';

export async function handleLogin(req, res) {
    const { userId, username, password, appState } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!username && !appState) return res.status(400).json({ error: 'Provide username/password or appState' });

    console.log(`[auth-insta] Login request for user ${userId}`);

    const ig = new IgApiClient();
    if (username) ig.state.generateDevice(username);

    try {
        let sessionData;
        if (appState) {
            // Parse AppState JSON (expected array of cookie objects)
            let parsed;
            try { parsed = typeof appState === 'string' ? JSON.parse(appState) : appState; }
            catch (e) { return res.status(400).json({ error: 'Invalid AppState JSON' }); }
            // Load cookies into Instagram client
            await ig.state.deserializeCookieJar(parsed);
            // Verify session by fetching current user
            const currentUser = await ig.account.currentUser();
            sessionData = JSON.stringify({ appState: parsed, username: currentUser.username, pk: currentUser.pk });
        } else {
            const loggedInUser = await ig.account.login(username, password);
            sessionData = JSON.stringify({ username, password, loggedInUser });
        }
        // Save to Redis
        await redis.set(`insta_session_${userId}`, sessionData, 'EX', 86400 * 30);
        // Update MongoDB with Instagram ID if available
        const dataObj = JSON.parse(sessionData);
        await User.findOneAndUpdate(
            { userId: String(userId) },
            { instagramId: String(dataObj.pk || ''), isActive: true },
            { upsert: true }
        );
        await MessengerSession.findOneAndUpdate(
            { userId: String(userId), platform: 'instagram' },
            { sessionData, isActive: true, identifier: username || (appState ? 'instagram-appstate' : '') },
            { upsert: true }
        );
        console.log(`[auth-insta] Successfully authenticated. Spawning FCA Client pod for user ${userId}`);
        await spawnPod(userId, sessionData);
        res.json({ success: true });
    } catch (err) {
        console.error(`[auth-insta] Login failed for user ${userId}:`, err);
        const msg = err.message || err.toString();
        if (/linked Facebook/i.test(msg)) {
            res.status(401).json({ error: 'Account linked to Facebook – use AppState JSON login instead.' });
        } else {
            res.status(401).json({ error: msg });
        }
    }
}