import { KVLike } from "./types";

export class RedisKV implements KVLike {
    constructor(private bridgeUrl: string, private secret: string) {}

    async get(key: string): Promise<string | null> {
        try {
            const res = await fetch(`${this.bridgeUrl}/kv/${key}?secret=${this.secret}`);
            if (!res.ok) {
                if (res.status === 404) return null;
                return null;
            }
            return await res.text();
        } catch (e) {
            console.error(`[RedisKV] get error for ${key}:`, e);
            return null;
        }
    }

    async put(key: string, value: string | ArrayBuffer | ArrayBufferView | ReadableStream, options?: { expirationTtl?: number }): Promise<void> {
        try {
            const strValue = typeof value === 'string' ? value : JSON.stringify(value);
            const url = new URL(`${this.bridgeUrl}/kv/${key}`);
            url.searchParams.set("secret", this.secret);
            if (options?.expirationTtl) {
                url.searchParams.set("ttl", options.expirationTtl.toString());
            }
            
            await fetch(url.toString(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: strValue })
            });
        } catch (e) {
            console.error(`[RedisKV] put error for ${key}:`, e);
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await fetch(`${this.bridgeUrl}/kv/${key}?secret=${this.secret}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error(`[RedisKV] delete error for ${key}:`, e);
        }
    }
}
