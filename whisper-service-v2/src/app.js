import express from 'express';
import { asrQueue, asrQueueEvents, redisCache } from './queue.js';
import { getAudioHash, makeCacheKey } from './asr.js';
import { Job } from 'bullmq';

const PORT = parseInt(process.env.PORT || '8000', 10);
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600', 10);
const WAIT_FOR_JOB_MS = parseInt(process.env.WAIT_FOR_JOB_MS || '300000', 10); // 5 minutes - needed for cold-start of large distil-large-v2 model on first job

const app = express();
app.use(express.json({ limit: '200mb' }));

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
      await healthRedis.quit().catch(() => {});
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

  try {
    const cached = await redisCache.get(cacheKey);
    if (cached) {
      const payload = JSON.parse(cached);
      return res.json({ ...payload, cache_hit: true });
    }
  } catch (error) {
    console.warn('[whisper-service-v2] Cache read failed:', error?.message || error);
  }

  let job;
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
      // Do NOT set removeOnComplete/removeOnFail here — it races with waitUntilFinished
    });
  } catch (error) {
    console.error('[whisper-service-v2] Queue add failed:', error?.message || error);
    return res.status(500).json({ error: 'Queue enqueue failed' });
  }

  try {
    // Use the shared QueueEvents instance — passing undefined was crashing BullMQ internally
    const result = await job.waitUntilFinished(asrQueueEvents, { timeout: WAIT_FOR_JOB_MS });
    return res.json({ ...result, cache_hit: false });
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes('timeout');

    if (isTimeout) {
      console.warn(`[whisper-service-v2] Job ${job.id} timed out after ${WAIT_FOR_JOB_MS}ms — first heavy job (cold model load) often needs 2-4 minutes on CPU`);
      // Return 202 so the caller knows it's still processing (tg-client will see it as error for now, but at least we don't lie with 500)
      return res.status(202).json({ status: 'processing', jobId: job.id, note: 'still working, try again in a few seconds' });
    }

    console.error('[whisper-service-v2] Job failed:', error?.message || error);
    return res.status(500).json({ error: 'Job processing failed', details: error?.message });
  }
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
  return res.json({ jobId, state, result });
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
