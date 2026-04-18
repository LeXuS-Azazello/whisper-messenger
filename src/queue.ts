import { Env, AudioJob, UserSession } from "./types";
import { sendMessageSafe, sendTypingOn, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn } from "./whatsapp";
import { sendTelegramMessage, sendTelegramTypingOn } from "./telegram";
import { transcribeWithFallback } from "./whisper";
import { logError } from "./logger";

export default async function queue(batch: MessageBatch<AudioJob>, env: Env) {
  for (const message of batch.messages) {
    const { userId, senderId, audioUrl, platform, replyToMsgId } = message.body;
    const start = Date.now();

    try {
      // 1. Resolve Tokens for this user
      let token = "";
      let whatsappPhoneId = env.WHATSAPP_PHONE_NUMBER_ID || "";
      const isThreads = platform === "threads";
      let u: UserSession | null = null;

      if (userId) {
        const userData = await env.STATS.get(`user_meta_${userId}`);
        if (userData) {
          u = JSON.parse(userData);
          if (u) {
            if (platform === "whatsapp") {
                token = u.whatsappToken || "";
                whatsappPhoneId = u.whatsappPhoneId || whatsappPhoneId;
            } else if (isThreads) {
                token = u.threadsToken || "";
            } else {
                token = u.metaToken || "";
            }
          }
        }
      }

      // Default tokens from env if not set for tenant
      if (!token) {
        if (platform === "whatsapp") {
          token = env.META_SYSTEM_USER_TOKEN || env.WHATSAPP_TOKEN || "";
        } else if (isThreads) {
          token = env.META_SYSTEM_USER_TOKEN || ""; // Threads MUST have a user token
        } else {
          token = env.META_SYSTEM_USER_TOKEN || env.META_PAGE_TOKEN || "";
        }
      }

      if (!token) throw new Error(`Permission denied: No token for ${platform} / ${userId}`);

      // 2. Notification (Typing...)
      if (platform === "whatsapp") {
        await sendWhatsAppTypingOn(whatsappPhoneId, senderId, token, env);
        await sendWhatsAppMessageSafe(whatsappPhoneId, senderId, "⏳ Transcribing...", token, env);
      } else if (platform === "telegram") {
        await sendTelegramTypingOn(Number(senderId), env);
        await sendTelegramMessage(Number(senderId), "⏳ Transcribing...", env);
      } else {
        await sendTypingOn(senderId, token, env, isThreads);
        await sendMessageSafe(senderId, "⏳ Transcribing...", token, env, isThreads);
      }

      // 3. Download Audio
      const fetchOptions: RequestInit | undefined = platform === "whatsapp"
        ? { headers: { Authorization: `Bearer ${token}` } }
        : undefined;

      const audioRes = await fetch(audioUrl, fetchOptions);
      if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
      const audioBuffer = await audioRes.arrayBuffer();

      // 4. Transcribe
      const result = await transcribeWithFallback(audioBuffer, env);
      let finalText = result.text;

      // 4.5 Translate if needed
      if (u && u.translateTo) {
        try {
          const ollamaUrl = env.OLLAMA_BASE_URL || "http://100.65.0.209:11434";
          const ollamaModel = env.OLLAMA_MODEL || "qwen3-coder:30b";
          const translateRes = await fetch(`${ollamaUrl}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: ollamaModel,
              messages: [
                { role: "system", content: `Translate the following audio transcription to ${u!.translateTo}. Output ONLY the translated text. Do not add any introductions or explanations.` },
                { role: "user", content: result.text }
              ],
              stream: false
            })
          });
          if (translateRes.ok) {
            const data: any = await translateRes.json();
            finalText = data.choices?.[0]?.message?.content || finalText;
          }
      } catch (e) {
        console.log(`[queue] Translation failed: ${(e as Error).message}`);
      }
    }

    const { incrementUserStats } = await import("./routes/dashboard");
    await incrementUserStats(userId!, env, platform);

    const flags: Record<string, string> = {
      en: "🇺🇸", uk: "🇺🇦", ru: "🇷🇺", es: "🇪🇸", de: "🇩🇪", fr: "🇫🇷", zh: "🇨🇳", ja: "🇯🇵"
    };
    const langFlag = u?.translateTo ? ` | ${flags[u.translateTo] || u.translateTo}` : "";

    const sec = ((Date.now() - start) / 1000).toFixed(1);
    finalText = `${finalText}\n\n⏱ ${sec}s${langFlag} | 🤖 ${result.model || 'Unknown'}`;
      const parts = splitLongText(finalText);

      // 5. Send Results
      if (platform === "whatsapp") {
        for (const part of parts) {
          await sendWhatsAppMessageSafe(whatsappPhoneId, senderId, part, token, env);
        }
      } else if (platform === "telegram") {
        for (const part of parts) {
          await sendTelegramMessage(Number(senderId), part, env, replyToMsgId);
        }
      } else {
        for (const part of parts) {
          await sendMessageSafe(senderId, part, token, env, isThreads);
        }
      }

    } catch (e) {
      const isRetryable = !(e instanceof MetaNonRetryableError);
      await logError(`queue_${platform}`, (e as Error).message, env);
      if (isRetryable) throw e;
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
