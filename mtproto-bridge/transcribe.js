import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, 'temp');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

async function transcribe(audioBuffer, mimeType, config = null) {
  const startTime = Date.now();
  const provider = config?.provider || process.env.WHISPER_PROVIDER || 'qwen3-asr';
  const secret = config?.secret || process.env.WHISPER_SECRET || '';

  if (provider === 'whisper-turbo') {
    const url = config?.whisperTurboUrl || process.env.WHISPER_TURBO_URL || 'http://whisper-turbo:8000';
    console.log(`[transcribe] Using Whisper-Turbo provider (Mime: ${mimeType})`);
    return transcribeWhisper(audioBuffer, mimeType, url, secret, startTime, 'whisper-turbo');
  } else {
    const qwenUrl = config?.qwenUrl || process.env.QWEN_ASR_URL || 'http://qwen3-asr:8000';
    console.log(`[transcribe] Using Qwen3-ASR provider (Mime: ${mimeType})`);
    return transcribeWhisper(audioBuffer, mimeType, qwenUrl, secret, startTime, 'qwen3-asr');
  }
}

async function transcribeWhisper(audioBuffer, mimeType, url, secret, startTime, providerName) {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', providerName === 'whisper-turbo' ? 'openai/whisper-large-v3-turbo' : 'qwen3-asr');

    const response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secret}` },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${providerName} error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return { text: data.text || data.transcription || '', duration: (Date.now() - startTime) / 1000 };
}

export { transcribe };