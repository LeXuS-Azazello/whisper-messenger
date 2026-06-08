import { FUNASR_URL } from './config.js';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 1800;

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
    
    let rawText = data.text || '';
    let lang = data.language || data.detected_language || data.detectedLanguage || 'auto';
    
    if (!lang || lang === 'auto' || lang === 'unknown') {
        const match = rawText.match(/<\|(ru|en|zh|ja|ko|de|fr|es|it|pt|uk|th|he|vi|id|ar|tr|pl|nl|hi|fa|ur)\|>/i);
        if (match) {
            lang = match[1].toLowerCase();
        }
    }
    
    let cleanText = rawText.replace(/<\|.*?\|>/g, '').trim();
    
    return {
        text: cleanText,
        language: lang,
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
                    console.log(`[transcriber] poll done | attempts=${i + 1} | totalPoll=${totalPollTime}ms | lastLatency=${pollLatency}ms`);
                    return normalizeResult(job.result, fallbackModel);
                }
                if (job.state === 'failed') {
                    const errMsg = job.result?.error || job.result?.details || 'Transcription job failed';
                    throw new Error(errMsg);
                }
            }
        } catch (e) {
            console.log(`[transcriber] poll #${i + 1} error: ${e?.message || e}`);
        }

        await sleep(POLL_INTERVAL_MS + Math.random() * 1500);
    }

    throw new Error('Transcription timed out after long polling');
}

async function _transcribeOnce(url, file_path, mime_type, language) {
    const defaultModelName = 'funasr-mlt-nano';

    const headers = {
        'Content-Type': 'application/json'
    };

    const tSubmit = Date.now();
    const payload = {
        file_path: file_path,
        mime_type: mime_type,
        language: language === 'auto' ? 'auto' : language
    };
    
    const response = await fetch(`${url}/v1/transcribe-base64`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3600000)
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

export async function transcribePath(file_path, mime_type, language = 'auto') {
    let url = FUNASR_URL || 'http://funasr:50001';

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    url = url.replace(/\/$/, '');

    console.log(`[transcriber] file_path=${file_path} | url=${url}`);

    try {
        const result = await _transcribeOnce(url, file_path, mime_type, language);
        return result;
    } catch (err1) {
        console.warn(`[transcriber] primary ASR failed (${url}): ${err1.message}`);

        await sleep(2500);
        try {
            console.log(`[transcriber] retry primary ASR...`);
            const result = await _transcribeOnce(url, file_path, mime_type, language);
            return result;
        } catch (err2) {
            console.warn(`[transcriber] retry primary ASR failed: ${err2.message}`);
            throw err2;
        }
    }
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