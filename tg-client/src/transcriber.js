import fs from 'fs';
import path from 'path';
import { WHISPER_PROVIDER, WHISPER_SECRET, redis } from './config.js';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 360; // ~12 minutes at 2s interval (still generous)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeResult(data, fallbackModel = 'whisper-service-v2') {
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

async function pollJobUntilDone(jobId, baseUrl, headers, fallbackModel = 'whisper-service-v2') {
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
          console.log(`[transcriber] poll done | attempts=${i+1} | totalPoll=${totalPollTime}ms | lastLatency=${pollLatency}ms | queueWait=${serverTiming.queueWaitMs ?? '?'} | process=${serverTiming.processMs ?? '?'}`);
          return normalizeResult(job.result, fallbackModel);
        }
        if (job.state === 'failed') {
          const errMsg = job.result?.error || job.result?.details || 'Transcription job failed';
          throw new Error(errMsg);
        }

        // still processing — log current server view
        if (i % 3 === 0 || serverTiming.queueWaitMs) {
          console.log(`[transcriber] poll #${i+1} | state=${job.state} | latency=${pollLatency}ms | serverQueueWait=${serverTiming.queueWaitMs ?? 'n/a'} | processedOn=${serverTiming.processedOn ?? 'waiting'}`);
        }
      }
    } catch (e) {
      // transient poll error — keep trying
      console.log(`[transcriber] poll #${i+1} error: ${e?.message || e}`);
    }

    await sleep(POLL_INTERVAL_MS + Math.random() * 1500);
  }

  throw new Error('Transcription timed out after long polling');
}

const WHISPER_FALLBACK_URL = 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';

/** Single-attempt transcription against a specific URL. Returns normalized result. */
async function _transcribeOnce(url, fileBuffer, mime_type, language, target_language) {
  const isSenseVoice = url.includes('sensevoice') || url.includes('50000');
  const isFunASR = url.includes('funasr') || url.includes('50001');
  const defaultModelName = isFunASR ? 'funasr' : (isSenseVoice ? 'sensevoice' : 'whisper-service-v2 (large-v3-turbo)');

  const headers = { 'Content-Type': 'application/json' };
  if (WHISPER_SECRET) {
    headers['Authorization'] = `Bearer ${WHISPER_SECRET}`;
  }

  const tSubmit = Date.now();
  let response;

  if (isSenseVoice) {
    const formData = new FormData();
    formData.append("files", new Blob([fileBuffer], { type: 'audio/wav' }), "audio.wav");
    formData.append("keys", "audio");
    formData.append("lang", language === 'auto' ? 'auto' : language);
    formData.append("use_itn", "false");
    
    response = await fetch(`${url}/api/v1/asr`, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(120000)
    });
  } else if (isFunASR) {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: 'audio/wav' }), "audio.wav");
    formData.append("model", "paraformer");
    formData.append("response_format", "json");

    const funHeaders = WHISPER_SECRET ? { "Authorization": `Bearer ${WHISPER_SECRET}` } : {};
    response = await fetch(`${url}/v1/audio/transcriptions`, {
      method: "POST",
      headers: funHeaders,
      body: formData,
      signal: AbortSignal.timeout(120000)
    });
  } else {
    const base64Data = fileBuffer.toString('base64');
    const payload = {
      file_data: base64Data,
      mime_type: mime_type,
      language: language
    };
    if (target_language) {
      payload.target_language = target_language;
    }
    response = await fetch(`${url}/v1/transcribe-base64`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    });
  }
  
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

  if (isSenseVoice) {
    const resData = data.result && data.result[0];
    data.text = resData ? resData.text : "";
    data.language = resData ? resData.language : "unknown";
    
    // SenseVoice hallucination cleanup
    let cleanText = data.text.replace(/<\|.*?\|>/g, '').trim();
    if (/^(嗯|啊|哦|угу|м|да|ну)+[.!?,。]*$/i.test(cleanText) || cleanText === '嗯' || cleanText === '嗯.' || cleanText === '嗯。') {
        cleanText = '';
    }
    data.text = cleanText;
  } else if (isFunASR) {
    data.text = data.text || data.transcription || "";
  }

  // If server returned a jobId instead of result, poll
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
    url = await redis.hget('stats', 'config_local_whisper_url');
  } catch (e) {
    console.error('[transcriber] redis error:', e.message);
  }
  if (!url) {
    url = WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
  }
  
  // Auto-correct common mistakes in WHISPER_PROVIDER
  if (url === 'whisper-turbo' || url === 'whisper-service-v2') {
    url = 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';
  } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
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

      // ── Attempt 3: fallback to whisper-service-v2 ──
      if (url !== WHISPER_FALLBACK_URL && !url.includes('whisper-service-v2')) {
        console.log(`[transcriber] ⚡ falling back to whisper-service-v2`);
        try {
          const result = await _transcribeOnce(WHISPER_FALLBACK_URL, fileBuffer, mime_type, language, target_language);
          return await _maybeTranslate(result, target_language);
        } catch (err3) {
          console.error(`[transcriber] fallback whisper-service-v2 also failed: ${err3.message}`);
          throw err3;
        }
      }
      throw err2;
    }
  }
}

/** Apply translation if needed */
async function _maybeTranslate(data, target_language) {
  if (target_language && target_language !== 'off' && !data.translated) {
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