'use strict';

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const sherpa_onnx = require('sherpa-onnx-node');

const MODEL_DIR = process.env.MODEL_DIR || path.join(__dirname, 'models', 'paraformer');
const NUM_THREADS = parseInt(process.env.ASR_NUM_THREADS || '4', 10);
const TEMP_DIR = path.join(__dirname, 'temp');

let recognizer = null;

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function initRecognizer() {
  const modelPath = path.join(MODEL_DIR, 'model.int8.onnx');
  const tokensPath = path.join(MODEL_DIR, 'tokens.txt');

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Model not found: ${modelPath}`);
  }
  if (!fs.existsSync(tokensPath)) {
    throw new Error(`tokens.txt not found: ${tokensPath}`);
  }

  const config = {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80,
    },
    modelConfig: {
      paraformer: {
        model: modelPath,
      },
      tokens: tokensPath,
      numThreads: NUM_THREADS,
      provider: 'cpu',
      debug: 1,
    },
  };

  recognizer = new sherpa_onnx.OfflineRecognizer(config);
  console.log('[transcribe] Recognizer initialized');
  console.log('[transcribe] Model:', modelPath);
  console.log('[transcribe] Threads:', NUM_THREADS);

  return recognizer;
}

function getRecognizer() {
  if (!recognizer) {
    initRecognizer();
  }
  return recognizer;
}

async function convertAudioToPcm(inputBuffer, mimeType) {
  ensureTempDir();

  const inputExt = mimeType.includes('mp3') ? 'mp3' : 'ogg';
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

async function transcribe(audioBuffer, mimeType) {
  const startTime = Date.now();
  console.log(`[transcribe] Starting transcription, audio size: ${audioBuffer.length} bytes`);

  const r = getRecognizer();

  const { sampleRate, samples } = await convertAudioToPcm(audioBuffer, mimeType);
  console.log(`[transcribe] Converted to PCM: ${samples.length} samples, ${sampleRate} Hz`);

  const stream = r.createStream();
  stream.acceptWaveform({ sampleRate, samples: Array.from(samples) });

  r.decode(stream);
  const result = r.getResult(stream);

  return { 
    text: result.text || '', 
    duration: elapsed 
  };
}

function isInitialized() {
  return recognizer !== null;
}

module.exports = {
  transcribe,
  isInitialized,
  initRecognizer,
};