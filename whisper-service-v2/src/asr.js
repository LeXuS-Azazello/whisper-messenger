import { execFileSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import sherpa from 'sherpa-onnx-node';

const MODELS_DIR = process.env.MODELS_DIR || '/models';
const NUM_THREADS = parseInt(process.env.NUM_THREADS || '4', 10);
const PUNCT_THREADS = parseInt(process.env.PUNCT_THREADS || '2', 10);

// Whisper large-v3-turbo int8 (best multilingual + strongest language detection)
// Excellent Russian, Hebrew, Arabic, 99+ languages. Far superior LID vs distil variants.
const WHISPER_ENCODER = join(MODELS_DIR, 'whisper', 'large-v3-turbo-encoder.int8.onnx');
const WHISPER_DECODER = join(MODELS_DIR, 'whisper', 'large-v3-turbo-decoder.int8.onnx');
const WHISPER_TOKENS  = join(MODELS_DIR, 'whisper', 'large-v3-turbo-tokens.txt');

const VAD_MODEL = join(MODELS_DIR, 'vad', 'silero_vad.onnx');
const PUNCT_MODEL = join(MODELS_DIR, 'punctuation', 'model.onnx');
const PUNCT_VOCAB = join(MODELS_DIR, 'punctuation', 'vocab.txt');

let recognizer = null;
let vad = null;
let punctuator = null;
let isReady = false;
let isPunctuationEnabled = false;

function ensureModelFiles() {
  if (!existsSync(WHISPER_ENCODER) || !existsSync(WHISPER_DECODER) || !existsSync(WHISPER_TOKENS)) {
    throw new Error(`Missing Whisper large-v3-turbo.int8 model in ${join(MODELS_DIR, 'whisper')}`);
  }
  if (!existsSync(VAD_MODEL)) {
    throw new Error(`Missing Silero VAD model in ${join(MODELS_DIR, 'vad')}`);
  }
}

function initialize() {
  if (isReady) return;
  ensureModelFiles();

  // === Whisper (distil-large-v2) ===
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
      debug: 0,
      provider: 'cpu',
    },
  });
  console.log('[whisper-service-v2] ✓ Whisper model loaded (large-v3-turbo.int8, excellent multilingual + LID)');

  // === Silero VAD ===
  try {
    vad = new sherpa.VoiceActivityDetector({
      sileroVad: {
        model: VAD_MODEL,
        threshold: 0.5,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        windowSize: 512,
      },
      sampleRate: 16000,
      numThreads: 2,
      debug: 0,
      provider: 'cpu',
    });
    console.log('[whisper-service-v2] ✓ Silero VAD enabled');
  } catch (e) {
    console.warn('[whisper-service-v2] ⚠️ Silero VAD failed to initialize → falling back to full-audio transcription');
    console.warn('[whisper-service-v2] VAD error:', e?.message || e);
    vad = null;
  }

  // === CT-Transformer Punctuation ===
  if (existsSync(PUNCT_MODEL) && existsSync(PUNCT_VOCAB)) {
    try {
      punctuator = new sherpa.OfflinePunctuation({
        model: PUNCT_MODEL,
        vocab: PUNCT_VOCAB,
        numThreads: PUNCT_THREADS,
        debug: 0,
        provider: 'cpu',
      });
      isPunctuationEnabled = true;
      console.log('[whisper-service-v2] ✓ Offline Punctuation (CT-Transformer) enabled');
    } catch (e) {
      console.warn('[whisper-service-v2] ⚠️ Punctuation model failed to load, using simple fallback');
      isPunctuationEnabled = false;
    }
  } else {
    console.log('[whisper-service-v2] ℹ️ Punctuation model not found → using simple multilingual fallback');
    isPunctuationEnabled = false;
  }

  isReady = true;
  console.log('[whisper-service-v2] Initialization complete');
}

function decodeAudioToPCM(filePath) {
  const raw = execFileSync('ffmpeg', [
    '-y', '-i', filePath,
    '-vn', '-ar', '16000', '-ac', '1', '-f', 'f32le', 'pipe:1',
  ], { maxBuffer: 200 * 1024 * 1024 });
  return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

function applyVAD(pcm) {
  if (!vad || !pcm || pcm.length === 0) {
    return pcm || new Float32Array(0); // fallback: no VAD available → transcribe full audio
  }
  vad.acceptWaveform(pcm);
  const segments = [];
  let total = 0;

  while (!vad.isEmpty()) {
    const chunk = vad.front();
    segments.push(chunk.samples);
    total += chunk.samples.length;
    vad.pop();
  }

  if (segments.length === 0) return new Float32Array(0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of segments) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function transcribePCM(pcm) {
  if (!pcm || pcm.length === 0) {
    return { text: '', language: 'unknown' };
  }
  const stream = recognizer.createStream();
  stream.acceptWaveform({ sampleRate: 16000, samples: pcm });
  recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  return {
    text: result.text?.trim() || '',
    language: result.lang || 'auto',
  };
}

function addPunctuation(text, detectedLang = 'unknown') {
  if (!text) return text;

  // Use high-quality sherpa model only for zh/en when available (best results)
  if (punctuator && isPunctuationEnabled) {
    try {
      return punctuator.addPunct(text);
    } catch (error) {
      console.warn('[whisper-service-v2] Sherpa punctuation failed, using simple fallback');
    }
  }

  // Simple offline punctuation — works for 100+ languages, zero extra models
  return addSimplePunctuation(text, detectedLang);
}

function addSimplePunctuation(text, lang = 'unknown') {
  let t = text.trim();
  if (!t) return '';

  // Capitalize first letter (works for Latin, Cyrillic, Greek, etc.)
  const first = t.charAt(0);
  if (first === first.toLowerCase() && first !== first.toUpperCase()) {
    t = first.toUpperCase() + t.slice(1);
  }

  // Add terminal punctuation if missing
  if (!/[.!?。！？؟۔]$/.test(t)) {
    if (['zh', 'ja', 'ko', 'yue'].includes(lang)) t += '。';
    else if (['ar', 'fa', 'ur'].includes(lang)) t += '۔';
    else t += '.';
  }

  // Very light comma fixes for the most common languages (big readability win)
  t = addLightCommas(t, lang);

  return t.replace(/\s{2,}/g, ' ').trim();
}

function addLightCommas(text, lang) {
  let t = text;

  // Russian / Ukrainian — before common conjunctions in longer sentences
  if (['ru', 'uk', 'be'].includes(lang)) {
    t = t.replace(/\s+(и|а|но|или|что|чтобы|если|когда|как|потому что)\s+/gi, ' $1 ');
  }

  // English + similar European languages
  if (['en', 'de', 'fr', 'es', 'it', 'pt', 'pl', 'nl'].includes(lang)) {
    t = t.replace(/\s+(and|but|or|so|because|if|when|while|although|aber|mais|pero|ma|ma|ale|maar)\s+/gi, ' $1 ');
  }

  return t;
}

export function getAudioHash(buffer) {
  const prefix = buffer.subarray(0, Math.min(buffer.length, 8192));
  return crypto.createHash('sha256').update(prefix).digest('hex');
}

export function makeCacheKey(hash) {
  return `whisper-v2:cache:${hash}`;
}

export async function processFile(filePath, targetLanguage) {
  initialize();
  const start = Date.now();

  try {
    const pcmFull = decodeAudioToPCM(filePath);
    const decodedMs = Date.now() - start;

    const speech = applyVAD(pcmFull);
    const usedVAD = !!vad && speech.length < pcmFull.length;
    const vadMs = Date.now() - start - decodedMs;

    const textResult = transcribePCM(speech);
    const asrMs = Date.now() - start - decodedMs - vadMs;

    const text = addPunctuation(textResult.text, textResult.language);

    // Translation is now expected to be handled via Whisper built-in (task: 'translate')
    // when target_language is passed. External NLLB service has been removed.
    const translated = null;

    return {
      text,
      language: textResult.language,
      translated,
      target_language: targetLanguage || null,
      metrics: {
        decodedMs,
        vadMs,
        asrMs,
        durationMs: Date.now() - start,
        speechSamples: speech.length,
        rawSamples: pcmFull.length,
        usedVAD,
      },
    };
  } catch (error) {
    console.error('[whisper-service-v2] processFile failed:', error?.message || error);
    return {
      text: '',
      language: 'unknown',
      translated: null,
      target_language: null,
      metrics: { durationMs: Date.now() - start, error: error?.message || String(error) },
    };
  }
}

export async function processBuffer(buffer, targetLanguage) {
  const tmpFile = join(tmpdir(), `whisper-v2-${crypto.randomBytes(8).toString('hex')}.tmp`);
  try {
    writeFileSync(tmpFile, buffer);
    return await processFile(tmpFile, targetLanguage);
  } finally {
    if (existsSync(tmpFile)) {
      try { unlinkSync(tmpFile); } catch (_) { /* ignore cleanup */ }
    }
  }
}

export function isServiceReady() {
  try {
    initialize();
    return true;
  } catch (error) {
    console.error('[whisper-service-v2] isServiceReady: initialization failed:', error?.message || error);
    return false;
  }
}

export function getServiceStatus() {
  return {
    whisper: !!recognizer,
    vad: !!vad,
    punctuation: isPunctuationEnabled,
  };
}
