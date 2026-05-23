/**
 * shared/samesame.js
 *
 * Reusable logic for SAMESAME voice cloning.
 * Can be imported from any messenger client (Telegram, WhatsApp, FB, IG).
 *
 * Usage example (in any client):
 *
 *   import { isSamesameRequest, extractSamesameText, cloneVoiceWithSamesame } from '../../shared/samesame.js';
 *
 *   if (isSamesameRequest(text) && repliedVoiceBuffer) {
 *     const cleanText = extractSamesameText(text);
 *     const { audioBuffer, contentType } = await cloneVoiceWithSamesame({
 *       sourceAudioBuffer: repliedVoiceBuffer,
 *       text: cleanText,
 *       samesameSecret: process.env.SAMESAME_SECRET
 *     });
 *     // send audioBuffer back as voice message
 *   }
 */

import fetch from 'node-fetch'; // or use global fetch if available in newer Node

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
 * Call the SAMESAME voice cloning service.
 *
 * @param {Object} options
 * @param {Buffer} options.sourceAudioBuffer - The original voice message audio (as Buffer)
 * @param {string} options.text - The text to synthesize in the cloned voice
 * @param {string} [options.language] - Optional language code
 * @param {string} [options.outputFormat] - 'ogg' | 'wav' (default 'ogg')
 * @param {string} [options.samesameUrl] - Internal service URL
 * @param {string} options.samesameSecret - Secret from SAMESAME_SECRET env
 * @returns {Promise<{audioBuffer: Buffer, contentType: string}>}
 */
export async function cloneVoiceWithSamesame({
  sourceAudioBuffer,
  text,
  language = null,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
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
    source_mime_type: 'audio/ogg', // most common for Telegram voice notes
    text: text.trim(),
    language: language || undefined,
    output_format: outputFormat
  };

  const url = `${samesameUrl.replace(/\/$/, '')}/v1/clone`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${samesameSecret}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`SAMESAME clone failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  const contentType = response.headers.get('content-type') || 'audio/ogg';

  return {
    audioBuffer,
    contentType
  };
}
