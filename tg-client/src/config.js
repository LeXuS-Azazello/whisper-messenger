import 'dotenv/config';
import { Redis } from 'ioredis';

export const MODE = process.env.MODE || 'USER';
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const TG_SESSION = process.env.TG_SESSION || '';
export const TG_API_ID = parseInt(process.env.TG_API_ID || process.env.TELEGRAM_APP_ID || '0', 10);
export const TG_API_HASH = process.env.TG_API_HASH || process.env.TELEGRAM_APP_HASH || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'changeme';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Desktop Linux';
export const APP_VERSION = process.env.APP_VERSION || '4.15.2';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Ubuntu 24.04';
export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://qwen3-asr:11434';
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen3:latest';

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
