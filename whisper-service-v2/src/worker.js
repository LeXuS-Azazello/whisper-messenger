import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { asrQueue, redisCache, ASR_QUEUE } from './queue.js';
import { processBuffer, getAudioHash, makeCacheKey, isServiceReady } from './asr.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10);
const PORT = parseInt(process.env.WORKER_PORT || '3001', 10);

// Best-effort warm-up: initialize models at startup so the worker is ready
// before the first job lands. A false return means a job will throw immediately
// and be retried, rather than the worker silently dying on the first payload.
try {
  isServiceReady();
  console.log('[whisper-service-v2 worker] Models initialized at startup');
} catch (error) {
  console.error('[whisper-worker-v2] FATAL: startup initialization failed:', error?.message || error);
  // Do NOT exit — let K8s restart if needed, but don't crash silently
}

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

  const result = await processBuffer(buffer, target_language);
  const payload = {
    text: result.text,
    language: result.language,
    translated: result.translated || null,
    target_language: result.target_language || null,
    metrics: result.metrics || {},
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

worker.on('error', (err) => {
  console.error('[whisper-service-v2] Worker error:', err?.message || err);
});

// Lightweight health endpoint for K8s liveness/diagnostic checks
const server = (async () => {
  const mod = await import('node:http');
  const { createServer } = mod;
  createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const ready = isServiceReady();
      const state = ready ? 'ok' : 'degraded';
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: state, queue: 'asr-v2', workerReady: ready }));
      return;
    }
    res.writeHead(404);
    res.end();
  }).listen(PORT, () => {
    console.log(`[whisper-service-v2 worker] Health endpoint on port ${PORT}`);
  });
})().catch((err) => {
  console.error('[whisper-service-v2 worker] Failed to start health endpoint:', err?.message || err);
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
