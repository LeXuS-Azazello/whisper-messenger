import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, 'temp');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || '';
const WHISPER_SECRET = process.env.WHISPER_SECRET || '';

async function transcribe(audioBuffer, mimeType, config = null) {
  const startTime = Date.now();
  
  const provider = config?.provider || 'local';
  const localUrl = config?.localUrl || WHISPER_SERVER_URL || 'https://whisper-onnx.debug.org.ua';
  const localSecret = config?.localSecret || WHISPER_SECRET || 'whisper-sh-secret-2026';
  const ollamaUrl = config?.ollamaUrl || 'http://100.65.0.209:11434';
  const ollamaModel = config?.model || 'whisper';

  console.log(`[transcribe] Using provider: ${provider} (Mime: ${mimeType})`);

  if (provider === 'local') {
    return transcribeLocal(audioBuffer, mimeType, localUrl, localSecret, startTime);
  } else if (provider === 'ollama') {
    return transcribeOllama(audioBuffer, mimeType, ollamaUrl, ollamaModel, startTime);
  } else if (provider === 'cloudflare') {
    // For cloudflare, we need to use the worker as a proxy or hit CF AI directly
    // Since this is a bridge, hit the worker's test-whisper endpoint or similar
    // For now, fallback to local if cloudflare implementation is too complex for here
    console.warn(`[transcribe] Cloudflare provider not natively supported in bridge, falling back to local`);
    return transcribeLocal(audioBuffer, mimeType, localUrl, localSecret, startTime);
  }

  return transcribeLocal(audioBuffer, mimeType, localUrl, localSecret, startTime);
}

async function transcribeLocal(audioBuffer, mimeType, url, secret, startTime) {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');

    const response = await fetch(`${url}/transcribe`, {
        method: 'POST',
        headers: { 'x-whisper-secret': secret },
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Local Whisper error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return { text: data.text || '', duration: (Date.now() - startTime) / 1000 };
}

async function transcribeOllama(audioBuffer, mimeType, url, model, startTime) {
    // Ollama needs base64
    const base64Audio = audioBuffer.toString('base64');
    
    const isNativeWhisper = model === "whisper";
    const endpoint = isNativeWhisper ? "/api/transcribe" : "/api/generate";
    const body = isNativeWhisper 
      ? { model, audio: base64Audio }
      : { model, prompt: `Transcribe this audio (base64): ${base64Audio}`, stream: false };

    const response = await fetch(`${url}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const text = isNativeWhisper ? data.text : data.response;
    return { text: text || '', duration: (Date.now() - startTime) / 1000 };
}

export { transcribe };