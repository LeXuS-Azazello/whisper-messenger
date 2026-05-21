import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

export const ASR_QUEUE = 'asr-v2';

export const redisConn = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
});

export const redisCache = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
});

export const asrQueue = new Queue(ASR_QUEUE, {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }),
    defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 2000 },
        removeOnComplete: { count: 100, age: 3600 },
        removeOnFail: { count: 50, age: 86400 },
    },
});

export const asrQueueEvents = new QueueEvents(ASR_QUEUE, {
    connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }),
});
