import fs from 'fs';
import path from 'path';
import { telegramLangToNLLB } from './lang.js';
import { FUNASR_URL, redis } from './config.js';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 1800; // ~1 hour at 2s interval

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeResult(data, fallbackModel = 'funasr-service') {
  if (typeof data !== 'object') {
    return {
      text: String(data),
      language: 'auto',
      translated: false,
      model: fallbackModel,
      metrics: {}
    };
  }
  let m = data.model || data.used_model;
  if (!m || m === 'unknown model') m = fallbackModel;
  return {
    text: data.text || '',
    language: data.language || data.detected_language || data.detectedLanguage || 'auto',
    translated: data.translated || null,
    target_language: data.target_language || null,
    model: m,
    metrics: data.metrics || null
  };
}

async function pollJobUntilDone(jobId, baseUrl, headers, fallbackModel = 'funasr-service') {
  console.log(`[transcriber] 🔄 Polling job ${jobId} at ${baseUrl}/v1/status/${jobId}`);
  const pollStart = Date.now();
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    const pollAttemptStart = Date.now();
    try {
      const res = await fetch(`${baseUrl}/v1/job/${jobId}`, {
        headers,
        signal: AbortSignal.timeout(15000)
      });
      const pollLatency = Date.now() - pollAttemptStart;

      if (res.ok) {
        const job = await res.json();
        const serverTiming = job.timing || {};

        if (job.state === 'completed' && job.result) {
          const totalPollTime = Date.now() - pollStart;
          console.log(`[transcriber] poll done | attempts=${i + 1} | totalPoll=${totalPollTime}ms | lastLatency=${pollLatency}ms | queueWait=${serverTiming.queueWaitMs ?? '?'} | process=${serverTiming.processMs ?? '?'}`);
          return normalizeResult(job.result, fallbackModel);
        }
        if (job.state === 'failed') {
          const errMsg = job.result?.error || job.result?.details || 'Transcription job failed';
          throw new Error(errMsg);
        }

        // still processing — log current server view
        if (i % 3 === 0 || serverTiming.queueWaitMs) {
          console.log(`[transcriber] poll #${i + 1} | state=${job.state} | latency=${pollLatency}ms | serverQueueWait=${serverTiming.queueWaitMs ?? 'n/a'} | processedOn=${serverTiming.processedOn ?? 'waiting'}`);
        }
      }
    } catch (e) {
      // transient poll error — keep trying
      console.log(`[transcriber] poll #${i + 1} error: ${e?.message || e}`);
    }

    await sleep(POLL_INTERVAL_MS + Math.random() * 1500);
  }

  throw new Error('Transcription timed out after long polling');
}



/** Single-attempt transcription against a specific URL. Returns normalized result. */
async function _transcribeOnce(url, fileBuffer, mime_type, language, target_language) {
  const defaultModelName = 'funasr-mlt-nano';

  const headers = {
    'Content-Type': 'application/json'
  };

  const tSubmit = Date.now();
  const base64Data = fileBuffer.toString('base64');
  const payload = {
    file_data: base64Data,
    mime_type: mime_type,
    language: language === 'auto' ? 'auto' : telegramLangToNLLB(language) || language
  };
  if (target_language) {
    payload.target_language = target_language;
  }
  const response = await fetch(`${url}/v1/transcribe-base64`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3600000) // 1 hour
  });

  const submitMs = Date.now() - tSubmit;

  if (response.status === 202) {
    const body = await response.json().catch(() => ({}));
    const jobId = body.jobId || body.id;
    if (jobId) {
      console.log(`[transcriber] Job ${jobId} accepted in ${submitMs}ms — switching to long polling`);
      return await pollJobUntilDone(jobId, url, headers, defaultModelName);
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Transcriber HTTP ${response.status} ${body}`);
  }

  const data = await response.json();

  if (data.jobId || data.id) {
    const jobId = data.jobId || data.id;
    console.log(`[transcriber] submit ${submitMs}ms → got jobId ${jobId} (immediate poll path)`);
    return await pollJobUntilDone(jobId, url, headers, defaultModelName);
  }

  console.log(`[transcriber] submit ${submitMs}ms → immediate result (no job)`);
  return normalizeResult(data, defaultModelName);
}

export async function transcribePath(file_path, mime_type, language = 'auto', target_language = null) {
  let url = '';
  try {
    url = await redis.hget('stats', 'config_local_funasr_url');
  } catch (e) {
    console.error('[transcriber] redis error:', e.message);
  }
  if (!url) {
    url = FUNASR_URL || 'http://funasr:50001';
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'http://' + url;
  }
  url = url.replace(/\/$/, '');

  const tRead = Date.now();
  const fileBuffer = fs.readFileSync(file_path);
  const readMs = Date.now() - tRead;

  console.log(`[transcriber] file read ${readMs}ms | size=${fileBuffer.length}B | url=${url}`);

  // ── Attempt 1: primary ASR backend ──
  try {
    const result = await _transcribeOnce(url, fileBuffer, mime_type, language, target_language);
    return await _maybeTranslate(result, target_language);
  } catch (err1) {
    console.warn(`[transcriber] primary ASR failed (${url}): ${err1.message}`);

    // ── Attempt 2: retry primary after brief pause (pod may be restarting) ──
    await sleep(2500);
    try {
      console.log(`[transcriber] retry primary ASR...`);
      const result = await _transcribeOnce(url, fileBuffer, mime_type, language, target_language);
      return await _maybeTranslate(result, target_language);
    } catch (err2) {
      console.warn(`[transcriber] retry primary ASR failed: ${err2.message}`);

      throw err2;
    }
  }
}

/** Apply translation if needed */
async function _maybeTranslate(data, target_language) {
  if (target_language && target_language !== 'off' && target_language !== 'translate_off' && !data.translated) {
    const detectedLanguage = data.language || 'unknown';
    const isSameLanguage = detectedLanguage && target_language
      && (detectedLanguage.toLowerCase().startsWith(target_language.toLowerCase())
        || target_language.toLowerCase().startsWith(detectedLanguage.toLowerCase()));

    if (!isSameLanguage && data.text) {
      try {
        const { default: translate } = await import('google-translate-api-x');
        const transResult = await translate(data.text, { to: target_language });
        if (transResult && transResult.text) {
          data.translated = transResult.text;
          data.target_language = target_language;
        }
      } catch (err) {
        console.error(`[transcriber] Translation error:`, err.message);
      }
    }
  }
  return data;
}


export function splitTextIntoChunks(text, limit = 3900) {
  if (!text) return [];
  if (text.length <= limit) return [text];

  const chunks = [];
  let currentChunk = "";
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if ((currentChunk + (currentChunk ? '\n' : '') + paragraph).length > limit) {
      if (paragraph.length > limit) {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = "";
        const sentences = paragraph.match(/[^.!?]+[.!?]+(\s+|$)/g) || [paragraph];
        for (const sentence of sentences) {
          const clean = sentence.trim();
          if (!clean) continue;
          if ((currentChunk + (currentChunk ? ' ' : '') + clean).length > limit) {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = clean;
          } else {
            currentChunk = currentChunk ? currentChunk + ' ' + clean : clean;
          }
        }
      } else {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      }
    } else {
      currentChunk = currentChunk ? currentChunk + '\n' + paragraph : paragraph;
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter(Boolean);
}