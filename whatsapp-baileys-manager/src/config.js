if (process.env.NODE_ENV !== 'production') {
  try {
    await import('dotenv/config');
  } catch (e) {
    console.warn('dotenv not found, using environment variables');
  }
}

export const MODE = process.env.MODE || 'MANAGER';

// WhatsApp Baileys doesn't need API_ID/API_HASH like Telegram
export const API_ID = 0; // Placeholder for compatibility
export const API_HASH = ''; // Placeholder for compatibility

export const SECRET = (process.env.SECRET || process.env.MANAGER_SECRET || process.env.BRIDGE_SECRET || 'changeme').trim();
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Voicemsg-net WhatsApp Manager (Baileys)';
export const APP_VERSION = process.env.APP_VERSION || '1.0.0';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Linux';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';

// Import Redis only in manager mode
let redis = null;
if (MODE === 'MANAGER') {
  const { Redis } = await import('ioredis');
  redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
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
}

// Initialize MongoDB if Manager
if (MODE === 'MANAGER') {
  const mongoose = await import('mongoose');
  mongoose.connect(MONGODB_URI)
    .then(() => console.log(`[manager] Connected to MongoDB: ${MONGODB_URI}`))
    .catch(err => console.error(`[manager] MongoDB connection error:`, err.message));
}

export { redis };