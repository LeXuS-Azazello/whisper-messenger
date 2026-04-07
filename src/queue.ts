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

      if (userId) {
        const userData = await env.STATS.get(`user_meta_${userId}`);
        if (userData) {
          const u: UserSession = JSON.parse(userData);
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

      // Default tokens from env if not set for tenant
      if (!token) {
        if (platform === "whatsapp") token = env.WHATSAPP_TOKEN || "";
        else if (isThreads) token = ""; // Threads MUST have a user token
        else token = env.META_PAGE_TOKEN || "";
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
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      const finalText = `${result.text}\n\n⏱ ${sec}s`;
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
