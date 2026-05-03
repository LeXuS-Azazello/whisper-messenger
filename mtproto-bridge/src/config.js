import 'dotenv/config';
import { Redis } from 'ioredis';

export const MODE = process.env.MODE || 'MANAGER';
export const API_ID = parseInt(process.env.TG_API_ID || process.env.TELEGRAM_APP_ID || '0', 10);
export const API_HASH = process.env.TG_API_HASH || process.env.TELEGRAM_APP_HASH || '';
export const SECRET = process.env.BRIDGE_SECRET || 'changeme';
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const TG_SESSION = process.env.TG_SESSION || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Desktop Linux';
export const APP_VERSION = process.env.APP_VERSION || '4.15.2';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Ubuntu 24.04';

export const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
        if (MODE === 'USER') return null;
        return Math.min(times * 50, 2000);
    }
});
redis.on('error', err => {
    if (MODE === 'MANAGER') console.error('[redis] Error:', err.message);
});
