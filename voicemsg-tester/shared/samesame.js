/**
 * shared/samesame.js
 *
 * Reusable logic for SAMESAME voice cloning.
 * Can be imported from any messenger client (Telegram, WhatsApp, FB, IG).
 *
 * Usage example (in any client):
 *
 *   import { isSamesameRequest, parseSamesameRequest, cloneVoiceWithSamesame } from '../../shared/samesame.js';
 *
 *   if (isSamesameRequest(text) && repliedVoiceBuffer) {
 *     const { text: cleanText, language } = parseSamesameRequest(text);
 *     const { audioBuffer, contentType } = await cloneVoiceWithSamesame({
 *       sourceAudioBuffer: repliedVoiceBuffer,
 *       text: cleanText,
 *       language,
 *       samesameSecret: process.env.SAMESAME_SECRET
 *     });
 *     // send audioBuffer back as voice message
 *   }
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
  text,
  language = null,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
  sourceMimeType = 'audio/ogg',
  samesameUrl = DEFAULT_SAMESAME_URL,
  samesameSecret
}) {
  if (!sourceAudioBuffer || !Buffer.isBuffer(sourceAudioBuffer)) {
    throw new Error('sourceAudioBuffer must be a Buffer');
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('text is required for voice cloning');
  }
  if (!samesameSecret) {
    throw new Error('SAMESAME_SECRET is not configured');
  }

  const base64Audio = sourceAudioBuffer.toString('base64');

  const payload = {
    source_audio_base64: base64Audio,
    source_mime_type: sourceMimeType,
    text: text.trim(),
    language: language || undefined,
    output_format: outputFormat
  };

  const url = `${samesameUrl.replace(/\/$/, '')}/v1/clone`;

  console.log(`[samesame] Starting voice clone request (text length: ${text.length}, language: ${language || 'default'})`);
  console.time(`[samesame] Voice Clone (${text.length} chars)`);

  // Use a custom dispatcher to override the default 5-minute (300,000ms) headersTimeout
  let dispatcher;
  try {
    const { Agent } = await import('undici');
    dispatcher = new Agent({ headersTimeout: 900000, connectTimeout: 60000 });
  } catch (e) {
    console.warn('[samesame] undici not found, falling back to default fetch without custom timeout dispatcher.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${samesameSecret}`
    },
    body: JSON.stringify(payload),
    dispatcher: dispatcher,
    signal: AbortSignal.timeout(900000) // 15 minutes overall timeout
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
    contentType: data.content_type || 'audio/ogg'
  };
}
