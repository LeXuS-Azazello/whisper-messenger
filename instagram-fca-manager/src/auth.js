import { IgApiClient } from 'instagram-private-api';
import { redis } from './config.js';
import User from './models/User.js';
import MessengerSession from './models/MessengerSession.js';
import { spawnPod } from './k8s.js';

export async function handleLogin(req, res) {
    const { userId, username, password } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });

    console.log(`[auth-insta] Login request for user ${userId}`);

    const ig = new IgApiClient();
    ig.state.generateDevice(username);

    try {
        const loggedInUser = await ig.account.login(username, password);
        
        // Get session data (we need to serialize the state)
        const sessionData = JSON.stringify({
            username: username,
            password: password, // Store for re-login capability
            loggedInUser: loggedInUser
        });

        // Save to Redis
        await redis.set(`insta_session_${userId}`, sessionData, 'EX', 86400 * 30);
        
        // Update MongoDB
        await User.findOneAndUpdate(
            { userId: String(userId) },
            { instagramId: String(loggedInUser.pk), isActive: true },
            { upsert: true }
        );
        await MessengerSession.findOneAndUpdate(
            { userId: String(userId), platform: 'instagram' },
            { sessionData: sessionData, isActive: true, identifier: username },
            { upsert: true }
        );

        console.log(`[auth-insta] Successfully authenticated. Spawning FCA Client pod for user ${userId}`);
        await spawnPod(userId, sessionData);

        res.json({ success: true });
    } catch (err) {
        console.error(`[auth-insta] Login failed for user ${userId}:`, err);
        res.status(401).json({ error: err.message || 'Login failed' });
    }
}