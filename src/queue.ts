import { Env, UserSession } from "./types";
import { sendTelegramMessage, sendTelegramTypingOn } from "./telegram";
import { transcribeAudio } from "./whisper";
import { incrementUserStats } from "./routes/dashboard";
import { logError } from "./logger";

async function getManagerUrl(env: Env): Promise<string> {
  return (env.MANAGER_URL || "").trim() || `http://tg-client-manager:3000`;
}

export default async function queue(batch: any, env: Env) {
  for (const message of batch.messages) {
    const { userId, senderId, audioUrl, platform, replyToMsgId } = message.body;
    const start = Date.now();

    try {
      let u: UserSession | null = null;
      if (userId) {
        const userData = await env.STATS.get(`user_meta_${userId}`);
        if (userData) u = JSON.parse(userData);
      }

      const transcribingMessage = `⏳ Transcribing with Whisper Turbo...`;

      // Telegram notifications
      if (platform === "telegram") {
        await sendTelegramTypingOn(Number(senderId), env);
        await sendTelegramMessage(Number(senderId), transcribingMessage, env);
      }

      // Download audio
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
      const audioBuffer = await audioRes.arrayBuffer();

      // Get user's preferred translation language (Dashboard setting)
      const targetLang = u?.preferredTranslationLanguage || u?.preferred_translation_lang || null;

      // Transcribe with auto-detect + optional translation
      const result = await transcribeAudio(audioBuffer, env, targetLang);

      await incrementUserStats(userId!, env, platform);

      const sec = ((Date.now() - start) / 1000).toFixed(1);

      // Build nice output with language labels (similar to personal tg-client)
      const origLabel = getLangLabel(result.detectedLanguage);
      let finalText = `${origLabel} ${result.text}`;

      if (result.translated && result.targetLanguage) {
        const targetLabel = getLangLabel(result.targetLanguage);
        finalText += `\n\n${targetLabel} ${result.translated}`;
      }

      finalText += `\n\n🤖 ${result.model || 'whisper-v2'} | ⏱ ${sec}s`;
      const parts = splitLongText(finalText);

      // Send results
      if (platform === "telegram") {
        for (const part of parts) {
          await sendTelegramMessage(Number(senderId), part, env, replyToMsgId as number);
        }
      } else if (platform === "whatsapp") {
        // Send via WhatsApp Web manager
        const managerUrl = await getManagerUrl(env);
        for (const part of parts) {
          await fetch(`${managerUrl}/whatsapp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, to: senderId, text: part })
          });
        }
      }

    } catch (e) {
      await logError(`queue_${platform}`, (e as Error).message, env);
      throw e;
    }
  }
}

function splitLongText(text: string, maxLength: number = 2000): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}

// Local version of language label with flags (matches tg-client style)
function getLangLabel(code: string | null | undefined): string {
  if (!code) return '🌐 auto';
  const normalized = code.toLowerCase().split('_')[0];
  const map: Record<string, string> = {
    'ru': '🇷🇺 рус', 'rus': '🇷🇺 рус',
    'en': '🇺🇸 eng', 'eng': '🇺🇸 eng',
    'he': '🇮🇱 עבר', 'heb': '🇮🇱 עבר',
    'uk': '🇺🇦 укр',
    'de': '🇩🇪 нем', 'deu': '🇩🇪 нем',
    'fr': '🇫🇷 фр', 'fra': '🇫🇷 фр',
    'es': '🇪🇸 исп', 'spa': '🇪🇸 исп',
    'th': '🇹🇭 тай',
    'zh': '🇨🇳 кит', 'zho': '🇨🇳 кит',
    'ja': '🇯🇵 яп', 'jpn': '🇯🇵 яп',
    'ko': '🇰🇷 kor',
    'ar': '🇸🇦 ар', 'arb': '🇸🇦 ар',
    'vi': '🇻🇳 вьет',
    'id': '🇮🇩 инд',
    'tr': '🇹🇷 тур',
    'auto': '🌐 auto',
  };
  return map[normalized] || `🌐 ${normalized}`;
}