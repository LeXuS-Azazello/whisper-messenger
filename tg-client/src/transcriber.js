import { WHISPER_PROVIDER, WHISPER_SECRET } from './config.js';

export async function transcribePath(file_path, mime_type, language = 'auto') {
    const url = WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';

    const payload = {
        file_path: file_path,
        mime_type: mime_type,
        language: language
    };

    const headers = { 'Content-Type': 'application/json' };
    if (WHISPER_SECRET) {
        headers['Authorization'] = `Bearer ${WHISPER_SECRET}`;
    }

    const response = await fetch(`${url}/v1/transcribe-path`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(300000)
    });

    if (!response.ok) throw new Error(`Transcriber error (${response.status})`);
    const data = await response.json();
    return data.text || data.transcription || '';
}

export async function deleteSharedFile(file_path) {
    const url = WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';

    const payload = { file_path: file_path };
    const headers = { 'Content-Type': 'application/json' };
    if (WHISPER_SECRET) {
        headers['Authorization'] = `Bearer ${WHISPER_SECRET}`;
    }

    fetch(`${url}/v1/delete-file`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    }).catch(() => {});  // fire-and-forget
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