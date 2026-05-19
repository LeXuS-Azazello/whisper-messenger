import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { WHISPER_TURBO_URL, WHISPER_MODEL } from './config.js';

const execPromise = promisify(exec);

export async function extractAudioFromVideo(videoPath) {
    const audioPath = videoPath + '.wav';
    try {
        await execPromise(`ffmpeg -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`);
        return audioPath;
    } catch (error) {
        console.error(`[transcriber] ffmpeg extraction failed:`, error.message);
        throw error;
    }
}

export async function transcribeAudio(audioBuffer, mimeType) {
    const url = WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    const fileName = mimeType === 'audio/wav' ? 'audio.wav' : 'audio.ogg';
    
    formData.append('file', blob, fileName);
    formData.append('model', WHISPER_MODEL);
    formData.append('language', 'auto');

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) throw new Error(`Transcriber error (${response.status})`);
    const data = await response.json();
    return data.text || data.transcription || '';
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
