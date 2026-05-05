export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

// Simple KV stub for Cloudflare Workers (ioredis not supported)
export class RedisKV implements KVLike {
  private data = new Map<string, string>();
  
  constructor(redisURL: string) {
    console.log('[RedisKV] Using in-memory KV (Cloudflare Workers compatible)');
  }
  
  async get(key: string): Promise<string | null> {
    try {
      return this.data.get(key) || null;
    } catch (e) {
      console.error(`[RedisKV] get error for ${key}:`, e);
      return null;
    }
  }
  
  async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
    try {
      this.data.set(key, value);
    } catch (e) {
      console.error(`[RedisKV] put error for ${key}:`, e);
    }
  }
  
  async delete(key: string): Promise<void> {
    try {
      this.data.delete(key);
    } catch (e) {
      console.error(`[RedisKV] delete error for ${key}:`, e);
    }
  }
}
