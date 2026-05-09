import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { API_ID, API_HASH, DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION, SECRET } from './config.js';
import net from 'net';

export function createClient(sessionStr, options = {}) {
    const session = new StringSession(sessionStr || '');
    const client = new TelegramClient(session, API_ID, API_HASH, {
        connectionRetries: options.retries || 5,
        deviceModel: DEVICE_MODEL,
        appVersion: APP_VERSION,
        systemVersion: SYSTEM_VERSION,
        useIPV6: false,
        ...options
    });
    return client;
}

export function auth(req, res, next) {
    const s = req.headers['x-bridge-secret'] || req.query.secret;
    const isMatched = s === SECRET;
    if (!isMatched) {
        console.warn(`[bridge-auth] 401 Unauthorized. Received: ${s ? s.slice(0, 3) + '...' : 'NONE'}, Expected match: ${SECRET ? SECRET.slice(0, 3) + '...' : 'NONE'}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

export function withTimeout(promise, ms, name = 'Operation') {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

export function checkConnect(host, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        let finished = false;
        socket.setTimeout(2000);
        socket.on('connect', () => { if (!finished) { finished = true; socket.destroy(); resolve(true); } });
        socket.on('error', () => { if (!finished) { finished = true; socket.destroy(); resolve(false); } });
        socket.on('timeout', () => { if (!finished) { finished = true; socket.destroy(); resolve(false); } });
        socket.connect(port, host);
    });
}
