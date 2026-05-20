import fcaLogin from '@vangbanlanhat/fca-unofficial';
import { redis } from './config.js';
import User from './models/User.js';
import MessengerSession from './models/MessengerSession.js';
import { spawnPod } from './k8s.js';

const login = typeof fcaLogin === 'function' ? fcaLogin : (fcaLogin.default || fcaLogin);

export async function handleLogin(req, res) {
    const { userId, email, password, appState } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    console.log(`[auth-fca] Login request for user ${userId} using ${appState ? 'appState' : 'email/password'}`);

    let credentials = {};
    if (appState) {
        try {
            credentials.appState = typeof appState === 'string' ? JSON.parse(appState) : appState;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid appState JSON format' });
        }
    } else if (email && password) {
        credentials = { email, password };
    } else {
        return res.status(400).json({ error: 'Provide appState or email and password' });
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
                    
                    if (appState && /JSON|Unexpected|Expected \'\,\' or \'\]\'|position \d+/i.test(String(rawMsg))) {
                        return res.status(400).json({ error: `Invalid AppState JSON: ${rawMsg}. Ensure you pasted raw AppState JSON (an array) without trailing commas.` });
                    }
                    
                    if (!appState) {
                        return res.status(401).json({ error: `Credentials login failed: ${rawMsg}. Facebook blocks direct logins frequently; we highly recommend using AppState JSON instead.` });
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
                    { sessionData: appStateString, isActive: true, identifier: email || 'facebook-appstate' },
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
