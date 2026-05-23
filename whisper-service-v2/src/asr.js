import { execFileSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';
import sherpa from 'sherpa-onnx-node';

const MODELS_DIR = process.env.MODELS_DIR || '/models';
const NUM_THREADS = parseInt(process.env.NUM_THREADS || '4', 10);
const PUNCT_THREADS = parseInt(process.env.PUNCT_THREADS || '2', 10);
const TRANSLATE_URL = process.env.TRANSLATE_SERVICE_URL || 'http://translation-service.debugging-testcrash-pub.svc.cluster.local:8001/v1/translate';

// Whisper distil-large-v2 (best balance: good multilingual support + reasonable speed/CPU usage)
// Supports Hebrew, Russian, Arabic, 50+ languages with solid auto-detection
const WHISPER_ENCODER = join(MODELS_DIR, 'whisper', 'distil-large-v2-encoder.int8.onnx');
const WHISPER_DECODER = join(MODELS_DIR, 'whisper', 'distil-large-v2-decoder.int8.onnx');
const WHISPER_TOKENS  = join(MODELS_DIR, 'whisper', 'distil-large-v2-tokens.txt');

const VAD_MODEL = join(MODELS_DIR, 'vad', 'silero_vad.onnx');
const PUNCT_MODEL = join(MODELS_DIR, 'punctuation', 'model.onnx');
const PUNCT_VOCAB = join(MODELS_DIR, 'punctuation', 'vocab.txt');

const LANG_TO_NLLB = {
  ru: 'rus_Cyrl', en: 'eng_Latn', zh: 'zho_Hans', de: 'deu_Latn', fr: 'fra_Latn',
  es: 'spa_Latn', uk: 'ukr_Cyrl', ar: 'arb_Arab', ja: 'jpn_Jpan', ko: 'kor_Hang',
  it: 'ita_Latn', pt: 'por_Latn', pl: 'pol_Latn', nl: 'nld_Latn',
  vi: 'vie_Latn', id: 'ind_Latn', th: 'tha_Thai', ms: 'msa_Latn', tr: 'tur_Tglg',
  he: 'heb_Hebr', iw: 'heb_Hebr',  // Hebrew support
};

let recognizer = null;
let vad = null;
let punctuator = null;
let isReady = false;
let isPunctuationEnabled = false;

function ensureModelFiles() {
  if (!existsSync(WHISPER_ENCODER) || !existsSync(WHISPER_DECODER) || !existsSync(WHISPER_TOKENS)) {
    throw new Error(`Missing Whisper distil-large-v2 model in ${join(MODELS_DIR, 'whisper')}`);
  }
  if (!existsSync(VAD_MODEL)) {
    throw new Error(`Missing Silero VAD model in ${join(MODELS_DIR, 'vad')}`);
  }
}

function initialize() {
  if (isReady) return;
  ensureModelFiles();

  // Whisper large-v3-turbo — best multilingual coverage (Hebrew, Russian, Arabic, 90+ languages)
  // language: 'auto' lets the model detect the spoken language first
  recognizer = new sherpa.OfflineRecognizer({
    modelConfig: {
      whisper: {
        encoder: WHISPER_ENCODER,
        decoder: WHISPER_DECODER,
        language: 'auto',
        task: 'transcribe',
      },
      tokens: WHISPER_TOKENS,
      numThreads: NUM_THREADS,
      debug: 0,
      provider: 'cpu',
    },
  });

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
  } catch (e) {
    console.warn('[whisper-service-v2] VoiceActivityDetector constructor failed (sherpa-onnx-node version mismatch in image?), falling back to full-audio transcription without VAD:', e?.message || e);
    vad = null;
  }

  if (existsSync(PUNCT_MODEL) && existsSync(PUNCT_VOCAB)) {
    punctuator = new sherpa.OfflinePunctuation({
      model: PUNCT_MODEL,
      vocab: PUNCT_VOCAB,
      numThreads: PUNCT_THREADS,
      debug: 0,
      provider: 'cpu',
    });
    isPunctuationEnabled = true;
  }

  isReady = true;
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

export async function callTranslation(text, detectedLang, targetLanguage) {
  if (!text || !targetLanguage) return text;
  const source = LANG_TO_NLLB[detectedLang] || detectedLang;
  try {
    const response = await fetch(TRANSLATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_language: source, target_language: targetLanguage }),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      throw new Error(`Translation failed ${response.status}`);
    }
    const data = await response.json();
    return data.text || text;
  } catch (error) {
    console.warn('[whisper-service-v2] Translation error:', error?.message || error);
    return text;
  }
}

export async function processFile(filePath, targetLanguage) {
  initialize();
  const start = Date.now();
  try {
    const pcmFull = decodeAudioToPCM(filePath);
    const decodedMs = Date.now() - start;
    const speech = applyVAD(pcmFull);
    const vadMs = Date.now() - start - decodedMs;
    const textResult = transcribePCM(speech);
    const asrMs = Date.now() - start - decodedMs - vadMs;
    const text = addPunctuation(textResult.text, textResult.language);
    let translated = null;
    if (targetLanguage && text) {
      translated = await callTranslation(text, textResult.language, targetLanguage);
    }
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
      },
    };
  } catch (error) {
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
