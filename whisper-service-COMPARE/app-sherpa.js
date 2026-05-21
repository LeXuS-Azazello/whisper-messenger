/**
 * Вариант B: sherpa-onnx ASR сервис
 *
 * Pipeline:
 *   base64/multipart audio
 *     → ffmpeg decode → PCM 16kHz mono
 *     → Silero VAD (убирает тишину/паузы)
 *     → SenseVoice ASR (нативные C++ треды, не блокирует event loop)
 *     → CT-Transformer offline punctuation
 *     → { text, language }
 *
 * Совместим с API текущего whisper-service (/v1/transcribe-base64)
 */

import express from 'express';
import { execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import crypto from 'crypto';

// ── Sherpa-onnx imports ────────────────────────────────────────────────────
// NOTE: sherpa-onnx-node поставляется с prebuilt бинарями для linux-x64
// Нативные треды не блокируют Node.js event loop
import sherpa from 'sherpa-onnx-node';

const MODELS_DIR   = process.env.MODELS_DIR   || '/models';
const NUM_THREADS  = parseInt(process.env.NUM_THREADS || '4');
const PORT         = parseInt(process.env.PORT || '8000');
const TRANSLATE_URL = process.env.TRANSLATE_SERVICE_URL ||
    'http://translation-service.debugging-testcrash-pub.svc.cluster.local:8001/v1/translate';

// Маппинг коротких кодов языков SenseVoice → NLLB коды
const LANG_TO_NLLB = {
    'ru': 'rus_Cyrl', 'en': 'eng_Latn', 'zh': 'zho_Hans', 'de': 'deu_Latn',
     'fr': 'fra_Latn', 'es': 'spa_Latn', 'uk': 'ukr_Cyrl', 'ar': 'arb_Arab',
    'ja': 'jpn_Jpan', 'ko': 'kor_Hang', 'it': 'ita_Latn', 'pt': 'por_Latn',
    'pl': 'pol_Latn', 'tr': 'tur_Tglg', 'nl': 'nld_Latn', 'vi': 'vie_Latn',
};

// ── Инициализация моделей ─────────────────────────────────────────────────

console.log('[sherpa] Initializing SenseVoice ASR...');

/** @type {sherpa.OfflineRecognizer} */
const recognizer = new sherpa.OfflineRecognizer({
    senseVoice: {
        model:           `${MODELS_DIR}/sense_voice/model.int8.onnx`,
        language:        'auto',    // авто-детектирование языка
        useInverseTextNormalization: 1,
    },
    modelConfig: {
        tokens: `${MODELS_DIR}/sense_voice/tokens.txt`,
        numThreads: NUM_THREADS,
        debug: 0,
        provider: 'cpu',
    },
});

console.log('[sherpa] Initializing Silero VAD...');

/** @type {sherpa.VoiceActivityDetector} */
const vad = new sherpa.VoiceActivityDetector({
    sileroVad: {
        model:          `${MODELS_DIR}/vad/silero_vad.onnx`,
        threshold:      0.5,
        minSilenceDuration: 0.5,   // мин. тишина в секундах для разрезания
        minSpeechDuration:  0.25,
        windowSize:     512,
    },
    sampleRate: 16000,
    numThreads: 2,
    debug: 0,
    provider: 'cpu',
});

console.log('[sherpa] Initializing CT-Transformer Punctuation...');

/** @type {sherpa.OfflinePunctuation} */
let punctuator = null;
const punctModelPath = `${MODELS_DIR}/punctuation/model.onnx`;
if (existsSync(punctModelPath)) {
    punctuator = new sherpa.OfflinePunctuation({
        model:      punctModelPath,
        vocab:      `${MODELS_DIR}/punctuation/vocab.txt`,
        numThreads: 2,
        debug:      0,
        provider:   'cpu',
    });
    console.log('[sherpa] Punctuation model loaded!');
} else {
    console.warn('[sherpa] Punctuation model not found, skipping.');
}

console.log('[sherpa] All models ready!');

// ── Утилиты ────────────────────────────────────────────────────────────────

/**
 * Конвертирует аудио/видео файл в PCM Float32Array 16kHz mono через ffmpeg
 * @param {string} inputPath
 * @returns {Float32Array}
 */
function decodeAudioToPCM(inputPath) {
    // ffmpeg → raw PCM 16kHz float32 LE → stdout
    const raw = execSync(
        `ffmpeg -y -i "${inputPath}" -vn -ar 16000 -ac 1 -f f32le pipe:1`,
        { maxBuffer: 100 * 1024 * 1024 }  // 100MB буфер
    );
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
}

/**
 * Применяет VAD и возвращает только речевые сегменты как Float32Array
 * @param {Float32Array} pcm
 * @returns {Float32Array}
 */
function applyVAD(pcm) {
    vad.acceptWaveform(pcm);
    const speechSegments = [];
    let totalSamples = 0;

    while (!vad.isEmpty()) {
        const segment = vad.front();
        speechSegments.push(segment.samples);
        totalSamples += segment.samples.length;
        vad.pop();
    }

    if (speechSegments.length === 0) return new Float32Array(0);

    // Объединяем все речевые сегменты
    const combined = new Float32Array(totalSamples);
    let offset = 0;
    for (const seg of speechSegments) {
        combined.set(seg, offset);
        offset += seg.length;
    }
    return combined;
}

/**
 * Транскрибирует Float32Array PCM через SenseVoice
 * @param {Float32Array} pcm
 * @returns {{ text: string, language: string }}
 */
function transcribePCM(pcm) {
    if (pcm.length === 0) return { text: '', language: 'unknown' };

    const stream = recognizer.createStream();
    stream.acceptWaveform({ sampleRate: 16000, samples: pcm });
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);

    return {
        text:     result.text?.trim() || '',
        language: result.lang || 'auto',
    };
}

/**
 * Добавляет пунктуацию через CT-Transformer
 * @param {string} text
 * @returns {string}
 */
function addPunctuation(text) {
    if (!punctuator || !text) return text;
    try {
        return punctuator.addPunct(text);
    } catch (e) {
        console.warn('[sherpa] Punctuation failed:', e.message);
        return text;
    }
}

/**
 * Полный пайплайн: файл → текст
 * @param {string} filePath
 * @returns {{ text: string, language: string, vadMs: number, asrMs: number }}
 */
function processFile(filePath) {
    const t0 = Date.now();
    const pcmFull = decodeAudioToPCM(filePath);
    const decodeMs = Date.now() - t0;

    const t1 = Date.now();
    const pcmSpeech = applyVAD(pcmFull);
    const vadMs = Date.now() - t1;

    const speechRatio = pcmFull.length > 0
        ? (pcmSpeech.length / pcmFull.length * 100).toFixed(1)
        : 0;
    console.log(`[sherpa] VAD: ${speechRatio}% speech retained (${vadMs}ms)`);

    const t2 = Date.now();
    const { text: rawText, language } = transcribePCM(pcmSpeech);
    const asrMs = Date.now() - t2;

    const t3 = Date.now();
    const text = addPunctuation(rawText);
    const punctMs = Date.now() - t3;

    console.log(`[sherpa] Done: decode=${decodeMs}ms vad=${vadMs}ms asr=${asrMs}ms punct=${punctMs}ms lang=${language}`);
    console.log(`[sherpa] Text: ${text.slice(0, 80)}...`);

    return { text, language, vadMs, asrMs };
}

/**
 * Вызывает translation-service (NLLB-200) для перевода текста.
 * @param {string} text — оригинальный текст
 * @param {string} detectedLang — язык из ASR (короткий код или NLLB)
 * @param {string} targetLang — целевой язык (NLLB код, напр. "eng_Latn")
 * @returns {Promise<string>}
 */
async function callTranslation(text, detectedLang, targetLang) {
    if (!text || !targetLang) return text;
    const sourceLang = LANG_TO_NLLB[detectedLang] || detectedLang;
    try {
        const res = await fetch(TRANSLATE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, source_lang: sourceLang, target_lang: targetLang }),
            signal: AbortSignal.timeout(30000),
        });
        const data = await res.json();
        return data.text || text;
    } catch (e) {
        console.warn(`[sherpa] Translation failed: ${e.message}`);
        return text; // fallback — оригинал
    }
}

// ── Express сервер ────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '200mb' }));

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        model: 'sense-voice-small',
        device: 'cpu',
        numThreads: NUM_THREADS,
        translateUrl: TRANSLATE_URL,
    });
});

/**
 * POST /v1/transcribe-base64
 * Body: { file_data, mime_type, language?, target_language? }
 * Response: { text, chunks, language, translated?, target_language? }
 */
app.post('/v1/transcribe-base64', async (req, res) => {
    const { file_data, mime_type, target_language } = req.body;
    if (!file_data) return res.status(400).json({ error: 'Missing file_data' });

    const tmpFile = join(tmpdir(), `sherpa_${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
        const buf = Buffer.from(file_data, 'base64');
        writeFileSync(tmpFile, buf);

        const result = processFile(tmpFile);
        const chunks = result.text ? [result.text] : [];

        const response = {
            text: result.text,
            chunks,
            language: result.language,
        };

        // Опциональный перевод через translation-service
        if (target_language && result.text) {
            response.translated = await callTranslation(result.text, result.language, target_language);
            response.target_language = target_language;
        }

        res.json(response);
    } catch (e) {
        console.error('[sherpa] Error:', e.message);
        res.status(500).json({ error: e.message, text: '' });
    } finally {
        if (existsSync(tmpFile)) unlinkSync(tmpFile);
    }
});

/**
 * POST /v1/transcribe-path
 * Body: { file_path, language?, target_language? }
 */
app.post('/v1/transcribe-path', async (req, res) => {
    const { file_path, target_language } = req.body;
    if (!file_path || !existsSync(file_path)) {
        return res.status(400).json({ error: `File not found: ${file_path}`, text: '' });
    }
    try {
        const result = processFile(file_path);
        const response = { text: result.text, language: result.language };
        if (target_language && result.text) {
            response.translated = await callTranslation(result.text, result.language, target_language);
            response.target_language = target_language;
        }
        res.json(response);
    } catch (e) {
        console.error('[sherpa] Error:', e.message);
        res.status(500).json({ error: e.message, text: '' });
    }
});

app.listen(PORT, () => {
    console.log(`[sherpa] Service running on port ${PORT}`);
    console.log(`[sherpa] Threads: ${NUM_THREADS}`);
});
