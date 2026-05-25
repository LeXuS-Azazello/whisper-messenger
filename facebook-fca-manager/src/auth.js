import fcaLogin from '@vangbanlanhat/fca-unofficial';
import { redis } from './config.js';
import User from './models/User.js';
import MessengerSession from './models/MessengerSession.js';
import { spawnPod } from './k8s.js';

const login = typeof fcaLogin === 'function' ? fcaLogin : (fcaLogin.default || fcaLogin);

export async function handleLogin(req, res) {
    const { userId, appState } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    // Facebook credential login (email/password) is permanently dead — Facebook breaks the page scraping constantly.
    // We only accept AppState now.
    if (!appState) {
        console.warn(`[auth-fca] Rejected credential login attempt for user ${userId}`);
        return res.status(400).json({
            error: "Email + Password login is disabled for Facebook. Facebook blocks direct logins. Export AppState JSON using the C3C UFC Utility browser extension (Chrome/Firefox) and paste the array here."
        });
    }

    console.log(`[auth-fca] Login request for user ${userId} using appState`);

    let credentials = {};
    try {
        credentials.appState = typeof appState === 'string' ? JSON.parse(appState) : appState;
    } catch (e) {
        return res.status(400).json({ error: 'Invalid AppState JSON format — must be a JSON array of cookie objects' });
    }

    const loginOpts = {
        logLevel: 'silent',
        forceLogin: true,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36"
    };

    try {
        login(credentials, loginOpts, async (err, api) => {
            if (err) {
                    console.error(`[auth-fca] Login failed for user ${userId}:`, err);
                    const rawMsg = err.error || err.message || 'Login failed';

                    if (/JSON|Unexpected|Expected \'\,\' or \'\]\'|position \d+/i.test(String(rawMsg))) {
                        return res.status(400).json({ error: `Invalid AppState JSON: ${rawMsg}. Make sure you exported the full array from C3C UFC Utility extension (starts with [{\"key\":\"c_user\",...}]).` });
                    }

                    return res.status(401).json({ error: rawMsg });
                }

            try {
                // Get AppState
                const newAppState = api.getAppState();
                const appStateString = JSON.stringify(newAppState);

                // Save to Redis and Mongo
                await redis.set(`fb_session_${userId}`, appStateString, 'EX', 86400 * 30);
                await User.findOneAndUpdate(
                    { userId: String(userId) },
                    { metaToken: appStateString, isActive: true },
                    { upsert: true }
                );
                await MessengerSession.findOneAndUpdate(
                    { userId: String(userId), platform: 'facebook' },
                    { sessionData: appStateString, isActive: true, identifier: 'facebook-appstate' },
                    { upsert: true }
                );

                console.log(`[auth-fca] Successfully authenticated. Spawning FCA Client pod for user ${userId}`);
                await spawnPod(userId, appStateString);

                res.json({ success: true });
            } catch (saveErr) {
                console.error(`[auth-fca] Error saving session/spawning pod:`, saveErr);
                res.status(500).json({ error: saveErr.message });
            }
        });
    } catch (e) {
        console.error(`[auth-fca] Connection exception:`, e);
        res.status(500).json({ error: e.message });
    }
}
