import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { TG_API_ID, TG_API_HASH, DEVICE_MODEL, APP_VERSION, SYSTEM_VERSION } from './config.js';

export function createClient(sessionStr, options = {}) {
    const session = new StringSession(sessionStr || '');
    const client = new TelegramClient(session, TG_API_ID, TG_API_HASH, {
        connectionRetries: options.retries || 5,
        deviceModel: DEVICE_MODEL,
        appVersion: APP_VERSION,
        systemVersion: SYSTEM_VERSION,
        useIPV6: false,
        ...options
    });
    return client;
}
