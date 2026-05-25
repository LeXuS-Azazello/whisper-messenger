import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import sherpa from 'sherpa-onnx-node';
import { spawn } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';

/*
 * === CRITICAL PERFORMANCE RULES FOR sherpa-onnx ON CPU (per operator guidance) ===
 * 1. OMP_NUM_THREADS=1 + OMP_WAIT_POLICY=PASSIVE must be set in the container env
 *    (Dockerfile + K8s Deployment) BEFORE this module is loaded.
 *    This stops ONNX Runtime from creating a thread army on every inference.
 * 2. NUM_THREADS passed to OfflineRecognizer should be small (1-3) when running
 *    multiple replicas. "cores-1" or even "1" is often optimal for latency.
 * 3. Worker concurrency must stay at 1 (or physical_cores) — never 50.
 * 4. VAD minSpeechDuration tuned to 0.8-1.5s for amortization (see createVad()).
 * 5. Recognizer is a singleton (module scope) — never recreate per chunk.
 */

const MODELS_DIR = process.env.MODELS_DIR || '/models';
const NUM_THREADS = parseInt(process.env.NUM_THREADS || '2', 10);
const PUNCT_THREADS = parseInt(process.env.PUNCT_THREADS || '1', 10);

const WHISPER_ENCODER = join(MODELS_DIR, 'whisper', 'turbo-encoder.int8.onnx');
const WHISPER_DECODER = join(MODELS_DIR, 'whisper', 'turbo-decoder.int8.onnx');

const WHISPER_TOKENS_CANDIDATES = [
  join(MODELS_DIR, 'whisper', 'tokens.txt'),
  join(MODELS_DIR, 'whisper', 'turbo-tokens.txt'),
];

let WHISPER_TOKENS = WHISPER_TOKENS_CANDIDATES[0];

const VAD_MODEL = join(MODELS_DIR, 'vad', 'silero_vad.onnx');

const PUNCT_MODEL_NEW = join(MODELS_DIR, 'punctuation', 'model.int8.onnx');
const PUNCT_BPE_VOCAB = join(MODELS_DIR, 'punctuation', 'bpe.vocab');

let recognizer = null;
let punctuator = null;
let isReady = false;
let punctuationType = 'none';
let isPunctuationEnabled = false;

const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 512;
const FRAME_BYTES = FRAME_SAMPLES * 4;

function ensureModelFiles() {
  if (!existsSync(WHISPER_ENCODER) || !existsSync(WHISPER_DECODER)) {
    throw new Error('Missing Whisper model');
  }

  WHISPER_TOKENS = WHISPER_TOKENS_CANDIDATES.find(p => existsSync(p));

  if (!WHISPER_TOKENS) {
    throw new Error('Missing tokens.txt');
  }

  if (!existsSync(VAD_MODEL)) {
    throw new Error('Missing VAD model');
  }
}

function createVad() {
  // Bigger chunks = dramatically better inference amortization for sherpa-onnx on CPU.
  // Target: 800–1500 ms speech segments instead of tiny 100-200 ms fragments.
  // With worker concurrency=1 this still gives good "realtime feel" for voice messages.
  const minSpeech = parseFloat(process.env.VAD_MIN_SPEECH_DURATION || '0.85');
  const minSilence = parseFloat(process.env.VAD_MIN_SILENCE_DURATION || '0.35');

  return new sherpa.Vad({
    sileroVad: {
      model: VAD_MODEL,
      threshold: 0.45,
      minSilenceDuration: minSilence,
      minSpeechDuration: minSpeech,
      windowSize: 512,
    },
    sampleRate: SAMPLE_RATE,
    numThreads: 1,
    provider: 'cpu',
    debug: 0,
  });
}

function initialize() {
  if (isReady) return;

  ensureModelFiles();

  recognizer = new sherpa.OfflineRecognizer({
    modelConfig: {
      whisper: {
        encoder: WHISPER_ENCODER,
        decoder: WHISPER_DECODER,
        language: '',
        task: 'transcribe',
      },
      tokens: WHISPER_TOKENS,
      numThreads: NUM_THREADS,
    }
  });

  if (existsSync(PUNCT_MODEL_NEW) && existsSync(PUNCT_BPE_VOCAB)) {
    try {
      punctuator = new sherpa.OnlinePunctuation({
        model: {
          cnnBilstm: PUNCT_MODEL_NEW,
          bpeVocab: PUNCT_BPE_VOCAB,
          numThreads: PUNCT_THREADS,
          provider: 'cpu',
        }
      });
      isPunctuationEnabled = true;
      punctuationType = 'en-online';
      console.log('[whisper-service-v2] ✓ Online Punctuation + Truecasing enabled');
    } catch (e) {
      console.warn('[whisper-service-v2] ⚠️ English punctuation failed:', e?.message || e);
      punctuator = null;
      isPunctuationEnabled = false;
    }
  }

  isReady = true;
  console.log('[whisper-service-v2] Initialization complete');
}

function transcribeSegment(samples, language = '') {
  if (!samples?.length) {
    return { text: '', language };
  }

  const t0 = Date.now();
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: SAMPLE_RATE, samples });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);

  // Release native resources immediately (sherpa-onnx streams hold C++ memory / ONNX sessions)
  try {
    if (typeof stream.free === 'function') stream.free();
    else if (typeof stream.release === 'function') stream.release();
  } catch (_) {
    /* best effort */
  }

  const dt = Date.now() - t0;

  console.log(`[whisper] segment ${dt}ms | samples=${samples.length} | lang=${result.lang || language}`);

  return {
    text: result.text?.trim() || '',
    language: result.lang || language || 'unknown',
  };
}

function addPunctuation(text, lang) {
  if (!text || !isPunctuationEnabled || !punctuator) {
    return text;
  }
  try {
    return punctuator.addPunct(text);
  } catch (e) {
    return text;
  }
}

export async function processFile(filePath, targetLanguage) {
  const tInit = Date.now();
  initialize();
  const initMs = Date.now() - tInit;

  const tVAD = Date.now();
  const vad = createVad();
  const vadCreateMs = Date.now() - tVAD;

  const tFfmpeg = Date.now();
  const ffmpeg = spawn('ffmpeg', [
    '-i', filePath,
    '-vn',
    '-ac', '1',
    '-ar', '16000',
    '-f', 'f32le',
    'pipe:1',
  ]);

  const FRAME_SIZE = FRAME_BYTES;

  let buffer = Buffer.alloc(0);
  let finalText = '';
  let detectedLanguage = targetLanguage || '';

  const jobStart = Date.now();
  let decodeCount = 0;
  let totalDecodeMs = 0;
  let firstDataTs = null;
  let ffmpegFirstDataMs = 0;
  let totalFfmpegMs = 0;

  return await new Promise((resolve, reject) => {
    ffmpeg.stdout.on('data', (chunk) => {
      if (!firstDataTs) {
        firstDataTs = Date.now();
        ffmpegFirstDataMs = firstDataTs - tFfmpeg;
      }

      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= FRAME_SIZE) {
        const frame = buffer.subarray(0, FRAME_SIZE);
        buffer = buffer.subarray(FRAME_SIZE);

        const samples = new Float32Array(
          frame.buffer,
          frame.byteOffset,
          frame.byteLength / 4
        );

        vad.acceptWaveform(samples);

        while (!vad.isEmpty()) {
          const segment = vad.front();
          vad.pop();

          const tSeg = Date.now();
          const result = transcribeSegment(segment.samples, detectedLanguage);
          const dtSeg = Date.now() - tSeg;

          decodeCount++;
          totalDecodeMs += dtSeg;

          if (!detectedLanguage && result.language) {
            detectedLanguage = result.language;
          }

          if (result.text) {
            finalText += ' ' + result.text;
          }
        }
      }
    });

    ffmpeg.on('close', () => {
      totalFfmpegMs = Date.now() - tFfmpeg;

      try {
        if (typeof vad.flush === 'function') {
          vad.flush();
        }
      } catch (_) {}

      const tPunct = Date.now();
      try {
        while (!vad.isEmpty()) {
          const segment = vad.front();
          vad.pop();

          const tSeg = Date.now();
          const result = transcribeSegment(segment.samples, detectedLanguage);
          const dtSeg = Date.now() - tSeg;

          decodeCount++;
          totalDecodeMs += dtSeg;

          if (result.text) {
            finalText += ' ' + result.text;
          }
        }
      } catch (_) {}

      finalText = finalText.trim();
      const punctuated = addPunctuation(finalText, detectedLanguage);
      const punctMs = Date.now() - tPunct;

      const totalMs = Date.now() - jobStart;
      const avgDecode = decodeCount > 0 ? Math.round(totalDecodeMs / decodeCount) : 0;
      const modelName = 'large-v3-turbo (Sherpa-ONNX)';

      console.log(`[whisper] TRANSCRIPTION DONE | model=${modelName} | init=${initMs}ms | vadCreate=${vadCreateMs}ms | ffmpegFirstData=${ffmpegFirstDataMs}ms | ffmpegTotal=${totalFfmpegMs}ms | punct=${punctMs}ms | segments=${decodeCount} | totalProcess=${totalMs}ms | textLen=${punctuated.length}`);

      resolve({
        text: punctuated,
        language: detectedLanguage || 'unknown',
        translated: false,
        target_language: targetLanguage || null,
        model: 'large-v3-turbo (Sherpa-ONNX)',
        metrics: { usedVAD: true, totalMs, decodeCount, avgDecodeMs: avgDecode, initMs, ffmpegFirstDataMs, ffmpegTotalMs: totalFfmpegMs, punctMs },
      });
    });

    ffmpeg.on('error', reject);
  });
}

export async function processBuffer(buffer, targetLanguage) {
  const tWrite = Date.now();
  const tmpFile = join(
    tmpdir(),
    `whisper-v3-${crypto.randomBytes(8).toString('hex')}.ogg`
  );

  try {
    writeFileSync(tmpFile, buffer);
    const writeMs = Date.now() - tWrite;
    console.log(`[whisper] tmp write ${writeMs}ms | size=${buffer.length}B`);

    const res = await processFile(tmpFile, targetLanguage);
    return res;
  } finally {
    if (existsSync(tmpFile)) {
      try {
        unlinkSync(tmpFile);
      } catch (_) {}
    }
  }
}

export function getAudioHash(buffer) {
  const toHash = buffer.length > 8192 ? buffer.subarray(0, 8192) : buffer;
  return crypto.createHash('sha256').update(toHash).digest('hex');
}

export function makeCacheKey(hash) {
  return `whisper-v2:cache:${hash}`;
}

export function isServiceReady() {
  try {
    initialize();
    return true;
  } catch (error) {
    console.error('[whisper-service-v2] init failed:', error?.message || error);
    return false;
  }
}

export function getServiceStatus() {
  return {
    whisper: !!recognizer,
    vad: true,
    punctuation: isPunctuationEnabled ? punctuationType : 'none',
  };
}
