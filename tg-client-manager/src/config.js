import 'dotenv/config';
import { Redis } from 'ioredis';

export const MODE = process.env.MODE || 'MANAGER';
const rawApiId = (process.env.TG_API_ID || process.env.TELEGRAM_APP_ID || '').trim();
export const API_ID = rawApiId ? Number(rawApiId) : 0;
export const API_HASH = (process.env.TG_API_HASH || process.env.TELEGRAM_APP_HASH || '').trim();

console.log(`[config] API_ID check: raw="${rawApiId}", parsed=${API_ID}`);
console.log(`[config] API_HASH check: length=${API_HASH.length}`);

if (!API_ID || isNaN(API_ID)) {
    console.error(`[config] CRITICAL: TG_API_ID / TELEGRAM_APP_ID is invalid! Got: "${rawApiId}"`);
}
if (!API_HASH) {
    console.error(`[config] CRITICAL: TG_API_HASH / TELEGRAM_APP_HASH is missing!`);
}


if (!process.env.MANAGER_SECRET && !process.env.BRIDGE_SECRET) {
    throw new Error('MANAGER_SECRET or BRIDGE_SECRET environment variable must be set');
}
export const SECRET = (process.env.MANAGER_SECRET || process.env.BRIDGE_SECRET).trim();
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const TG_SESSION = process.env.TG_SESSION || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Voicemsg-net';
export const APP_VERSION = process.env.APP_VERSION || '4.15.2';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Ubuntu 24.04';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';


export const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    retryStrategy(times) {
        if (MODE === 'USER') return null;
        return Math.min(times * 50, 2000);
    }
});
redis.on('error', err => {
    if (MODE === 'MANAGER') console.error('[redis] Error:', err.message);
});
