import fs from 'fs';
import path from 'path';
import { WHISPER_PROVIDER, WHISPER_SECRET } from './config.js';

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [3000, 6000, 12000];

export async function transcribePath(file_path, mime_type, language = 'auto') {
    const url = WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';

    const fileBuffer = fs.readFileSync(file_path);
    const base64Data = fileBuffer.toString('base64');

    const payload = {
        file_data: base64Data,
        mime_type: mime_type,
        language: language
    };

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

            if (!response.ok) throw new Error(`Transcriber HTTP error (${response.status})`);
            const data = await response.json();
            return data.text || '';
        } catch (err) {
            lastError = err;
            const isNetworkErr = err.cause?.code === 'ECONNREFUSED'
                || err.cause?.code === 'ENOTFOUND'
                || err.cause?.code === 'ECONNRESET'
                || err.message === 'fetch failed';

            console.error(`[transcriber] Attempt ${attempt}/${MAX_RETRIES} failed (${url}): ${err.message}${err.cause ? ` [${err.cause.code}]` : ''}`);

            if (!isNetworkErr || attempt === MAX_RETRIES) break;

            const delay = RETRY_DELAYS_MS[attempt - 1] ?? 6000;
            console.log(`[transcriber] Retrying in ${delay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
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