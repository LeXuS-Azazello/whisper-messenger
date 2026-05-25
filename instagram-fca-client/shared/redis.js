import Redis from 'ioredis';

let redisInstance = null;

export function getRedis() {
  if (!redisInstance && process.env.REDIS_URL) {
    redisInstance = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisInstance.on('error', (err) => {
      console.error('[redis] Error:', err.message);
    });
  }
  return redisInstance;
}

export async function getPreferredTranslationLang(userId) {
  const redis = getRedis();
  if (!redis || !userId) return null;

  try {
    const raw = await redis.get(`user_meta_${userId}`);
    if (!raw) return null;

    const meta = JSON.parse(raw);
    return meta.preferred_translation_lang || meta.preferredTranslationLanguage || null;
  } catch (err) {
    console.error('[redis] Failed to read preferred_translation_lang:', err.message);
    return null;
  }
}

export async function reportClientStatus(platform, userId, status) {
  const redis = getRedis();
  if (!redis || !userId) return;

  const key = `${platform}_status_${userId}`;
  try {
    await redis.set(key, status, 'EX', 3600);
  } catch (err) {
    console.error(`[redis] Failed to report ${platform} status:`, err.message);
  }
}

export async function clearClientStatus(platform, userId) {
  const redis = getRedis();
  if (!redis || !userId) return;

  const statusKey = `${platform}_status_${userId}`;
  try {
    await redis.del(statusKey);
  } catch (err) {
    console.error(`[redis] Failed to clear ${platform} status:`, err.message);
  }
}
