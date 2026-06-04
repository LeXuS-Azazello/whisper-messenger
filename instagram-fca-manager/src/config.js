export const MODE = process.env.MODE || 'MANAGER';

if (!process.env.SECRET && !process.env.MANAGER_SECRET) {
    throw new Error('SECRET or MANAGER_SECRET environment variable must be set');
}
export const SECRET = (process.env.SECRET || process.env.MANAGER_SECRET).trim();
export const PORT = parseInt(process.env.PORT || '3005', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';

let redis = null;
if (MODE === 'MANAGER') {
  const { Redis } = await import('ioredis');
  redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: true,
    retryStrategy(times) {
      return Math.min(times * 50, 2000);
    }
  });

  redis.on('error', err => {
    console.error('[redis] Error:', err.message);
  });
}

export { redis };