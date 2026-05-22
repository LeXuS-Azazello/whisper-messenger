import 'dotenv/config';
import Redis from 'ioredis';

// WhatsApp Baileys doesn't need API_ID/API_HASH like Telegram
export const API_ID = 0; // Placeholder for compatibility
export const API_HASH = ''; // Placeholder for compatibility

export const SECRET = (process.env.MANAGER_SECRET || 'changeme').trim();
export const PORT = parseInt(process.env.PORT || '3000', 10);
export const TARGET_USER_ID = process.env.TARGET_USER_ID || '';
export const WORKER_URL = process.env.WORKER_URL || '';
export const DEVICE_MODEL = process.env.DEVICE_MODEL || 'Voicemsg-net WhatsApp (Baileys)';
export const APP_VERSION = process.env.APP_VERSION || '1.0.0';
export const SYSTEM_VERSION = process.env.SYSTEM_VERSION || 'Linux';
export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/voicemsg';

// === Redis (для preferred_translation_lang и user_meta) ===
let redisInstance = null;

function getRedis() {
  if (!redisInstance && process.env.REDIS_URL) {
    redisInstance = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisInstance.on('error', (err) => {
      console.error('[whatsapp-baileys-client] Redis error:', err.message);
    });

    console.log('[whatsapp-baileys-client] Redis connected for user preferences');
  }
  return redisInstance;
}

// In-memory cache (60 seconds TTL)
const langCache = new Map();
const CACHE_TTL_MS = 60_000;

export async function getPreferredTranslationLang(userId) {
  if (!userId) return null;

  const cacheKey = `lang_${userId}`;
  const cached = langCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.value;
  }

  const redis = getRedis();
  if (!redis) {
    return null;
  }

  try {
    const raw = await redis.get(`user_meta_${userId}`);
    if (!raw) {
      langCache.set(cacheKey, { value: null, timestamp: Date.now() });
      return null;
    }

    const meta = JSON.parse(raw);
    const lang = meta.preferred_translation_lang || meta.preferredTranslationLanguage || null;

    langCache.set(cacheKey, { value: lang, timestamp: Date.now() });
    return lang;
  } catch (err) {
    console.error('[whatsapp-baileys-client] Failed to read preferred_translation_lang from Redis:', err.message);
    return null;
  }
}

/* ==================== Status Reporting to Redis (for Dashboard) ==================== */

const TARGET_USER_ID = process.env.TARGET_USER_ID || '';

/**
 * Report QR code to Redis so Dashboard can display it.
 * Key: wa_qr_${userId}
 */
export async function reportQR(qr, info = '') {
  const redis = getRedis();
  if (!redis || !TARGET_USER_ID) return;

  try {
    await redis.set(
      `wa_qr_${TARGET_USER_ID}`,
      JSON.stringify({ qr, info, updatedAt: Date.now() }),
      'EX',
      300 // 5 minutes TTL
    );
  } catch (err) {
    console.error('[whatsapp-baileys-client] Failed to report QR to Redis:', err.message);
  }
}

/**
 * Report pairing code to Redis.
 * Key: wa_pairing_${userId}
 */
export async function reportPairingCode(code) {
  const redis = getRedis();
  if (!redis || !TARGET_USER_ID) return;

  try {
    await redis.set(`wa_pairing_${TARGET_USER_ID}`, code, 'EX', 300);
  } catch (err) {
    console.error('[whatsapp-baileys-client] Failed to report pairing code to Redis:', err.message);
  }
}

/**
 * Clear QR and pairing codes when client is ready.
 */
export async function clearConnectionCodes() {
  const redis = getRedis();
  if (!redis || !TARGET_USER_ID) return;

  try {
    await redis.del(`wa_qr_${TARGET_USER_ID}`, `wa_pairing_${TARGET_USER_ID}`);
    await redis.set(`wa_status_${TARGET_USER_ID}`, 'ready', 'EX', 3600);
  } catch (err) {
    console.error('[whatsapp-baileys-client] Failed to clear connection codes:', err.message);
  }
}

/**
 * Report current connection status to Redis.
 * Possible values: "connecting", "qr", "pairing", "ready", "error"
 */
export async function reportStatus(status) {
  const redis = getRedis();
  if (!redis || !TARGET_USER_ID) return;

  try {
    await redis.set(`wa_status_${TARGET_USER_ID}`, status, 'EX', 3600);
  } catch (err) {
    console.error('[whatsapp-baileys-client] Failed to report status:', err.message);
  }
}

// Export redis instance for advanced usage if needed
export const redis = getRedis;