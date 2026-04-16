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

async function convertAudioToPcm(inputBuffer, mimeType) {
  ensureTempDir();

  let inputExt = 'ogg';
  if (mimeType.includes('mp3')) inputExt = 'mp3';
  else if (mimeType.includes('mp4') || mimeType.includes('video')) inputExt = 'mp4';
  const inputPath = path.join(TEMP_DIR, `input_${Date.now()}.${inputExt}`);
  const outputPath = path.join(TEMP_DIR, `output_${Date.now()}.wav`);

  fs.writeFileSync(inputPath, inputBuffer);

  try {
    execSync(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 -acodec pcm_s16le "${outputPath}"`, {
      stdio: 'ignore'
    });

    const pcmBuffer = fs.readFileSync(outputPath);
    
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    const samples = new Int16Array(pcmBuffer.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = pcmBuffer.readInt16LE(i * 2);
    }

    return { sampleRate: 16000, samples };
  } catch (err) {
    console.error('[transcribe] Audio conversion error:', err.message);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    throw err;
  }
}

const WHISPER_SERVER_URL = process.env.WHISPER_SERVER_URL || '';
const WHISPER_SECRET = process.env.WHISPER_SECRET || '';

async function transcribe(audioBuffer, mimeType) {
  const startTime = Date.now();

  if (!WHISPER_SERVER_URL) {
      throw new Error('WHISPER_SERVER_URL not configured - external whisper server required');
  }

  console.log(`[transcribe] Using external Whisper Server: ${WHISPER_SERVER_URL}`);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType });
  formData.append('file', blob, 'audio.ogg');

  const response = await fetch(`${WHISPER_SERVER_URL}/transcribe`, {
      method: 'POST',
      headers: {
          'x-whisper-secret': WHISPER_SECRET
      },
      body: formData
  });

  if (!response.ok) {
      throw new Error(`Whisper server error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return {
      text: data.text || '',
      duration: (Date.now() - startTime) / 1000
  };
}

export function isInitialized() {
  return true; // Always use shared server
}

export { transcribe };