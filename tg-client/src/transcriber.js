import fs from 'fs';
import path from 'path';
import { WHISPER_PROVIDER, WHISPER_SECRET } from './config.js';

const MAX_RETRIES = 5;
const RETRY_DELAYS_MS = [5000, 10000, 20000, 40000]; // up to ~75s total patience

export async function transcribePath(file_path, mime_type, language = 'auto', target_language = null) {
    const url = WHISPER_PROVIDER || 'http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000';

    const fileBuffer = fs.readFileSync(file_path);
    const base64Data = fileBuffer.toString('base64');

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

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(`${url}/v1/transcribe-base64`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(300000)
            });

            if (!response.ok) {
                const body = await response.text().catch(() => '');
                throw new Error(`Transcriber HTTP ${response.status} ${body}`);
            }
            const data = await response.json();
            return {
                text: data.text || '',
                language: data.language || language,
                translated: data.translated || null,
                target_language: data.target_language || target_language || null
            };
        } catch (err) {
            lastError = err;
            const causeCode = err.cause?.code || '';
            const isTransient = causeCode === 'ECONNREFUSED'
                || causeCode === 'ENOTFOUND'
                || causeCode === 'ECONNRESET'
                || causeCode === 'ETIMEDOUT'
                || /fetch failed/i.test(String(err.message));

            console.error(`[transcriber] Attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${err.message} ${causeCode ? `[${causeCode}]` : ''}`);

            if (!isTransient || attempt === MAX_RETRIES) {
                break;
            }

            const baseDelay = RETRY_DELAYS_MS[attempt - 1] ?? 30000;
            const jitter = Math.floor(Math.random() * 4000); // avoid thundering herd
            const delay = baseDelay + jitter;

            console.log(`[transcriber] Transient network error — retrying in ${(delay/1000).toFixed(1)}s...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }

    throw lastError;
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