import { WHISPER_PROVIDER, WHISPER_SECRET } from './config.js';

export async function transcribeAudio(audioBuffer, mimeType, language = 'auto') {
    const url = WHISPER_PROVIDER || 'http://whisper-turbo.debugging-testcrash-pub.svc.cluster.local:8000';
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    const fileName = mimeType === 'audio/wav' ? 'audio.wav' : 'audio.ogg';

    formData.append('file', blob, fileName);
    formData.append('language', language);

    const headers = {};
    if (WHISPER_SECRET) {
        headers['Authorization'] = `Bearer ${WHISPER_SECRET}`;
    }

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        headers,
        body: formData,
        signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) throw new Error(`Transcriber error (${response.status})`);
    const data = await response.json();
    return data.text || data.transcription || '';
}

export async function transcribeAudio(audioBuffer, mimeType, language = 'auto') {
    // ... (above function)
}
