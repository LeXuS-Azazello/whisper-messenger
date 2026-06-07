/**
 * Language mapping for SAMESAME - inline to avoid import issues
 */
function telegramLangToNLLB(code) {
  if (!code) return null;
  const map = {
    ru: 'rus_Cyrl', uk: 'ukr_Cyrl', en: 'eng_Latn', de: 'deu_Latn', fr: 'fra_Latn',
    es: 'spa_Latn', it: 'ita_Latn', ja: 'jpn_Jpan', ko: 'kor_Hang', zh: 'zho_Hans',
    th: 'tha_Thai', he: 'heb_Hebr'
  };
  const key = code.toLowerCase().split('_')[0];
  return map[key] || null;
}

/**
 * shared/samesame.js
 *
 * Reusable logic for SAMESAME voice cloning.
 * Can be imported from any messenger client (Telegram, WhatsApp, FB, IG).
 */

const DEFAULT_SAMESAME_URL = 'http://samesame:8002';
const DEFAULT_OUTPUT_FORMAT = 'ogg';

/**
 * Check if the text contains the SAMESAME magic word (case-insensitive)
 */
export function isSamesameRequest(text) {
  if (typeof text !== 'string') return false;
  return /!SAMESAME!/i.test(text);
}

/**
 * Remove the !SAMESAME! marker and clean the text
 */
export function extractSamesameText(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/!SAMESAME!/gi, '').trim();
}

/**
 * Parse a SAMESAME request.
 * Supports optional leading language code: "!SAMESAME! ru Hello world"
 * Returns { text, language: string|null }
 */
export function parseSamesameRequest(text) {
  const clean = extractSamesameText(text);
  if (!clean) return { text: '', language: null };

  // Match optional 2-letter language code at the start (e.g. "ru ", "en ")
  const match = clean.match(/^([a-z]{2})\s+(.+)$/i);
  if (match) {
    return {
      text: match[2].trim(),
      language: match[1].toLowerCase()
    };
  }
  return { text: clean, language: null };
}
/**
 * Helper to translate SAMESAME text before cloning.
 */
export async function translateSamesameText(text, targetLang) {
  if (!targetLang || targetLang === 'auto') return text;
  try {
    const { default: translate } = await import('google-translate-api-x');
    const res = await translate(text, { to: targetLang });
    return res.text || text;
  } catch (e) {
    console.error('[samesame] translate error:', e.message);
    return text;
  }
}
/**
 * Call the SAMESAME voice cloning service.
 *
 * @param {Object} options
 * @param {Buffer} options.sourceAudioBuffer - The original voice message audio (as Buffer)
 * @param {string} options.text - The text to synthesize in the cloned voice
 * @param {string} [options.language] - Optional language code
 * @param {string} [options.outputFormat] - 'ogg' | 'wav' (default 'ogg')
 * @param {string} [options.sourceMimeType] - 'audio/ogg' | 'video/mp4' etc. (default 'audio/ogg')
 * @param {string} [options.samesameUrl] - Internal service URL
 * @param {string} options.samesameSecret - Secret from SAMESAME_SECRET env
 * @returns {Promise<{audioBuffer: Buffer, contentType: string}>}
 */
export async function cloneVoiceWithSamesame({
  sourceAudioBuffer,
  sourceAudioPath,
  text,
  language = null,
  userId = null,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
  sourceMimeType = 'audio/ogg',
  samesameUrl = DEFAULT_SAMESAME_URL,
  samesameSecret
}) {
  if (!sourceAudioBuffer && !sourceAudioPath) {
    throw new Error('Either sourceAudioBuffer or sourceAudioPath must be provided');
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text is required for voice cloning');
  }
  if (!samesameSecret) {
    throw new Error('SAMESAME_SECRET is not configured');
  }

  const payload = {
    source_mime_type: sourceMimeType,
    text: text.trim(),
    language: language ? telegramLangToNLLB(language) || language : undefined,
    user_id: userId,
    output_format: outputFormat,
    stream: false
  };

  if (sourceAudioPath) {
    payload.source_audio_path = sourceAudioPath;
  } else if (sourceAudioBuffer) {
    payload.source_audio_base64 = sourceAudioBuffer.toString('base64');
  }

  const url = `${samesameUrl.replace(/\/$/, '')}/v1/clone`;

  console.log(`[samesame] Starting voice clone request (text length: ${text.length}, language: ${language || 'default'})`);
  console.time(`[samesame] Voice Clone (${text.length} chars)`);

  // Use native http/https with explicit socket timeout (15 min) to avoid undici headersTimeout issue
  const parsedUrl = new URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const bodyStr = JSON.stringify(payload);

  const response = await new Promise(async (resolve, reject) => {
    const lib = isHttps ? (await import('https')).default : (await import('http')).default;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + (parsedUrl.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${samesameSecret}`,
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    const req = lib.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(buf.toString())),
          text: () => Promise.resolve(buf.toString())
        });
      });
    });
    req.setTimeout(900000, () => { req.destroy(new Error('Samesame request timeout after 15 minutes')); });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });

  console.timeEnd(`[samesame] Voice Clone (${text.length} chars)`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`SAMESAME clone failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const audioBuffer = Buffer.from(data.audio_base64, 'base64');

  return {
    audioBuffer,
    contentType: data.content_type || 'audio/ogg',
    model: data.model || 'samesame-cosyvoice'
  };
}
