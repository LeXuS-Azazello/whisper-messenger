import express from 'express';
import { asrQueue, asrQueueEvents, redisCache } from './queue.js';
import { getAudioHash, makeCacheKey } from './asr.js';
import { Job } from 'bullmq';

const PORT = parseInt(process.env.PORT || '8000', 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10);
let WAIT_FOR_JOB_MS = 300000; // 5 minutes default
if (process.env.WAIT_FOR_JOB_MS) {
  const parsed = parseInt(process.env.WAIT_FOR_JOB_MS, 10);
  if (!Number.isNaN(parsed)) {
    WAIT_FOR_JOB_MS = parsed;
  } else {
    console.warn(`[whisper-service-v2] WAIT_FOR_JOB_MS="${process.env.WAIT_FOR_JOB_MS}" is not a number, using default ${WAIT_FOR_JOB_MS}ms`);
  }
}
console.log(`[whisper-service-v2] WAIT_FOR_JOB_MS set to ${WAIT_FOR_JOB_MS}ms`);

const app = express();

app.use(express.json({ limit: '50mb' }));

app.get('/health', async (req, res) => {
  // Lenient health for liveness: transient Redis hiccups (or slow PING) should not kill the container.
  // The worker + main redisConn handle real queue health. We just need to know the API process is alive.
  try {
    const healthRedis = new Redis(process.env.REDIS_URL || 'redis://redis:6379', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: true,
    });
    let pong = 'skipped';
    try {
      await healthRedis.connect();
      pong = await healthRedis.ping();
    } catch (_) {
      // ignore – still return ok so liveness doesn't restart us during Redis blips
    } finally {
      await healthRedis.quit().catch(() => { });
    }
    res.json({ status: 'ok', queue: 'asr-v2', redis: pong });
  } catch (error) {
    // even on total failure, return 200 so the container isn't killed by liveness
    const msg = error instanceof Error ? error.message : String(error);
    res.json({ status: 'ok', queue: 'asr-v2', redis: msg, note: 'lenient' });
  }
});

app.post('/v1/transcribe-base64', async (req, res) => {
  const { file_data, mime_type, target_language } = req.body || {};

  if (!file_data) {
    return res.status(400).json({ error: 'Missing file_data' });
  }

  let buffer;
  try {
    buffer = Buffer.from(file_data, 'base64');
  } catch (error) {
    return res.status(400).json({ error: 'Invalid base64 data', details: error?.message || String(error) });
  }

  const audioHash = getAudioHash(buffer);
  const cacheKey = makeCacheKey(audioHash);

  const tCache = Date.now();
  try {
    const cached = await redisCache.get(cacheKey);
    const cacheMs = Date.now() - tCache;
    if (cached) {
      const payload = JSON.parse(cached);
      console.log(`[whisper-service-v2] CACHE_HIT on submit | ${cacheMs}ms`);
      return res.json({ ...payload, cache_hit: true });
    }
    if (cacheMs > 20) {
      console.log(`[whisper-service-v2] cache miss in ${cacheMs}ms`);
    }
  } catch (error) {
    console.warn('[whisper-service-v2] Cache read failed:', error?.message || error);
  }

  let job;
  const tEnqueue = Date.now();
  try {
    job = await asrQueue.add('transcribe', {
      file_data,
      mime_type,
      target_language,
      cacheKey,
      audioHash,
    }, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 2000 },
    });

    const enqueueMs = Date.now() - tEnqueue;
    if (target_language) {
      console.log(`[whisper-service-v2] New job ${job.id} enqueued in ${enqueueMs}ms with target_language=${target_language}`);
    } else {
      console.log(`[whisper-service-v2] New job ${job.id} enqueued in ${enqueueMs}ms`);
    }
  } catch (error) {
    console.error('[whisper-service-v2] Queue add failed:', error?.message || error);
    return res.status(500).json({ error: 'Queue enqueue failed' });
  }

  // Always return quickly with jobId so clients (tg-client) can poll /v1/job/:id
  // This prevents long-blocking HTTP requests that cause 500 timeouts on CPU-heavy jobs.
  console.log(`[whisper-service-v2] Job ${job.id} accepted (202) — client should poll`);
  return res.status(202).json({
    status: 'processing',
    jobId: job.id,
    note: 'Transcription job started. Use GET /v1/job/' + job.id + ' to check status.'
  });
});

app.get('/v1/job/:id', async (req, res) => {
  const jobId = req.params.id;
  let job;
  try {
    job = await Job.fromId(asrQueue, jobId);
  } catch (error) {
    return res.status(500).json({ error: 'Cannot inspect job', details: error?.message });
  }
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const state = await job.getState();
  const result = await job.returnvalue;
  const timing = {
    enqueuedAt: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    queueWaitMs: job.processedOn && job.timestamp ? (job.processedOn - job.timestamp) : null,
    processMs: job.finishedOn && job.processedOn ? (job.finishedOn - job.processedOn) : null,
  };
  return res.json({ jobId, state, result, timing });
});

app.post('/v1/transcribe-path', async (req, res) => {
  const { file_path, target_language } = req.body || {};
  if (!file_path) {
    return res.status(400).json({ error: 'Missing file_path' });
  }

  const buffer = Buffer.from(file_path, 'utf8');
  const audioHash = getAudioHash(buffer);
  return res.status(501).json({ error: 'Path transcription not implemented', cache_key: makeCacheKey(audioHash) });
});

if (process.argv[1].endsWith('app.js')) {
  app.listen(PORT, () => {
    console.log(`[whisper-service-v2] Listening on ${PORT}`);
  });
}

export { app };
