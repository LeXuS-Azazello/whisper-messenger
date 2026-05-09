import Redis from 'ioredis';

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export class RedisKV implements KVLike {
  private redis: Redis | null = null;
  private inMemory = new Map<string, string>();

  constructor(redisURL?: string) {
    if (redisURL && redisURL.startsWith('redis://')) {
      try {
        this.redis = new Redis(redisURL);
        console.log('[RedisKV] Connected to Redis');
      } catch (e) {
        console.error('[RedisKV] Failed to connect to Redis, falling back to in-memory:', e);
        this.redis = null;
      }
    } else {
      console.log('[RedisKV] No Redis URL provided, using in-memory KV');
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.redis) {
        return await this.redis.get(key);
      }
      return this.inMemory.get(key) || null;
    } catch (e) {
      console.error(`[RedisKV] get error for ${key}:`, e);
      return null;
    }
  }

  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      if (this.redis) {
        if (options?.expirationTtl) {
          await this.redis.setex(key, options.expirationTtl, value);
        } else {
          await this.redis.set(key, value);
        }
        return;
      }
      this.inMemory.set(key, value);
    } catch (e) {
      console.error(`[RedisKV] put error for ${key}:`, e);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
        return;
      }
      this.inMemory.delete(key);
    } catch (e) {
      console.error(`[RedisKV] delete error for ${key}:`, e);
    }
  }
}
