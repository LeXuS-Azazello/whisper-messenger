import { KVLike } from "./types";
import Redis from "ioredis";

export class RedisKV implements KVLike {
    private redis: Redis;

    constructor(connectionString: string) {
        // connectionString can be "redis://redis:6379" or just the host
        this.redis = new Redis(connectionString);
        
        this.redis.on('error', (err) => {
            console.error('[RedisKV] Redis error:', err);
        });
    }

    async get(key: string): Promise<string | null> {
        try {
            return await this.redis.get(key);
        } catch (e) {
            console.error(`[RedisKV] get error for ${key}:`, e);
            return null;
        }
    }

    async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number }): Promise<void> {
        try {
            const strValue = typeof value === 'string' ? value : JSON.stringify(value);
            if (options?.expirationTtl) {
                await this.redis.set(key, strValue, 'EX', options.expirationTtl);
            } else {
                await this.redis.set(key, strValue);
            }
        } catch (e) {
            console.error(`[RedisKV] put error for ${key}:`, e);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.redis.del(key);
        } catch (e) {
            console.error(`[RedisKV] delete error for ${key}:`, e);
        }
    }
}
