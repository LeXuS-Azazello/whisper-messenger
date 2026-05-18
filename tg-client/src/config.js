import 'dotenv/config';
import { Redis } from 'ioredis';

export const MODE = process.env.MODE || 'USER';
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const TG_SESSION = process.env.TG_SESSION || '';
export const TG_API_ID = parseInt(process.env.TG_API_ID || process.env.TELEGRAM_APP_ID || '0', 10);
export const TG_API_HASH = process.env.TG_API_HASH || process.env.TELEGRAM_APP_HASH || '';
export const MANAGER_URL = process.env.MANAGER_URL || process.env.WORKER_URL || '';
export const MANAGER_SECRET = process.env.MANAGER_SECRET || process.env.BRIDGE_SECRET || 'changeme';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Desktop Linux';
export const APP_VERSION = process.env.APP_VERSION || '4.15.2';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Ubuntu 24.04';
export const WHISPER_TURBO_URL = process.env.WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
export const WHISPER_PROVIDER = process.env.WHISPER_PROVIDER || 'whisper-turbo';
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
export const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';


export const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    }
});
redis.on('error', err => {
    console.error('[tg-client redis] Error:', err.message);
});
