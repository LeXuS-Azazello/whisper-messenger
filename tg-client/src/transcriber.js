import fs from 'fs';
import path from 'path';
import { WHISPER_PROVIDER, WHISPER_SECRET } from './config.js';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 360; // ~12 minutes at 2s interval (still generous)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeResult(data) {
  return {
    text: data.text || '',
    language: data.language || data.detected_language || data.detectedLanguage || 'auto',
    translated: data.translated || null,
    target_language: data.target_language || null
  };
}

async function pollJobUntilDone(jobId, baseUrl, headers) {
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
          return normalizeResult(job.result);
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

export async function transcribePath(file_path, mime_type, language = 'auto', target_language = null) {
  const url = WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';

  const tRead = Date.now();
  const fileBuffer = fs.readFileSync(file_path);
  const base64Data = fileBuffer.toString('base64');
  const readMs = Date.now() - tRead;

  console.log(`[transcriber] file read+base64 ${readMs}ms | size=${fileBuffer.length}B`);

  const payload = {
    file_data: base64Data,
    mime_type: mime_type,
    language: language
  };

  if (target_language) {
    payload.target_language = target_language;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (WHISPER_SECRET) {
    headers['Authorization'] = `Bearer ${WHISPER_SECRET}`;
  }

  // 1. Submit the job (short timeout for the initial request)
  const tSubmit = Date.now();
  const response = await fetch(`${url}/v1/transcribe-base64`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000) // 60s to submit
  });
  const submitMs = Date.now() - tSubmit;

  if (response.status === 202) {
    // Server accepted the job and returned jobId for polling
    const body = await response.json().catch(() => ({}));
    const jobId = body.jobId || body.id;
    if (jobId) {
      console.log(`[transcriber] Job ${jobId} accepted in ${submitMs}ms — switching to long polling`);
      return await pollJobUntilDone(jobId, url, headers);
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Transcriber HTTP ${response.status} ${body}`);
  }

  const data = await response.json();

  // 2. If server returned a jobId instead of result, poll
  if (data.jobId || data.id) {
    const jobId = data.jobId || data.id;
    console.log(`[transcriber] submit ${submitMs}ms → got jobId ${jobId} (immediate poll path)`);
    return await pollJobUntilDone(jobId, url, headers);
  }

  // 3. Immediate result (old sync path)
  console.log(`[transcriber] submit ${submitMs}ms → immediate result (no job)`);
  return normalizeResult(data);
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