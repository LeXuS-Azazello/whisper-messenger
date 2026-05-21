import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { asrQueue, redisCache, ASR_QUEUE } from './queue.js';
import { processBuffer, getAudioHash, makeCacheKey } from './asr.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10);

const worker = new Worker(ASR_QUEUE, async (job) => {
  const { file_data, target_language, cacheKey } = job.data;
  if (!file_data) {
    throw new Error('Missing file_data in job payload');
  }

  const buffer = Buffer.from(file_data, 'base64');
  const computedHash = getAudioHash(buffer);
  const key = cacheKey || makeCacheKey(computedHash);

  const cached = await redisCache.get(key);
  if (cached) {
    return JSON.parse(cached);
  }

  const response = await processBuffer(buffer, target_language);
  const payload = {
    text: response.text,
    language: response.language,
    translated: response.translated || null,
    target_language: response.target_language || null,
    metrics: response.metrics || {},
  };
  await redisCache.set(key, JSON.stringify(payload), 'EX', CACHE_TTL);
  return payload;
}, {
  connection: new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false }),
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '1', 10),
});

worker.on('completed', (job) => {
  console.log(`[whisper-service-v2] Job completed ${job.id}`);
});

worker.on('failed', (job, err) => {
  console.error(`[whisper-service-v2] Job failed ${job?.id}:`, err?.message || err);
});

process.on('SIGINT', async () => {
  await worker.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  process.exit(0);
});

console.log('[whisper-service-v2] Worker started');
