import { Env, AudioJob, UserSession } from "./types";
import { sendMessageSafe, sendTypingOn, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn } from "./whatsapp";
import { sendTelegramMessage, sendTelegramTypingOn } from "./telegram";
import { sendLineTypingOn, sendLineMessageSafe, getLineAudioArrayBuffer } from "./line";
import { transcribeWithFallback } from "./whisper";
import { logError } from "./logger";

export default async function queue(batch: any, env: Env) {
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
            } else if (platform === "line") {
                token = u.lineToken || "";
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

      // 2. Determine model for transcribing message (always Qwen3-ASR)
      const modelDisplayName = "Qwen3-ASR";
      const transcribingMessage = `⏳ Transcribing with ${modelDisplayName}...`;

      // 3. Notification (Typing...)
      if (platform === "whatsapp") {
        await sendWhatsAppTypingOn(whatsappPhoneId, senderId, token, env);
        await sendWhatsAppMessageSafe(whatsappPhoneId, senderId, transcribingMessage, token, env, replyToMsgId);
      } else if (platform === "telegram") {
        await sendTelegramTypingOn(Number(senderId), env);
        await sendTelegramMessage(Number(senderId), transcribingMessage, env);
      } else if (platform === "line") {
        await sendLineTypingOn(senderId, token);
      } else {
        await sendTypingOn(senderId, token, env, isThreads);
        await sendMessageSafe(senderId, transcribingMessage, token, env, isThreads, replyToMsgId);
      }

      // 4. Download Audio
      let audioBuffer: ArrayBuffer;
      if (platform === "line") {
        const buf = await getLineAudioArrayBuffer(audioUrl, token);
        if (!buf) throw new Error("LINE audio download failed");
        audioBuffer = buf;
      } else {
        const fetchOptions: RequestInit | undefined = platform === "whatsapp"
          ? { headers: { Authorization: `Bearer ${token}` } }
          : undefined;

        const audioRes = await fetch(audioUrl, fetchOptions);
        if (!audioRes.ok) throw new Error(`Audio download failed: ${audioRes.status}`);
        audioBuffer = await audioRes.arrayBuffer();
      }

      // 5. Transcribe
      const result = await transcribeWithFallback(audioBuffer, env);
      let finalText = result.text;

    const { incrementUserStats } = await import("./routes/dashboard");
    await incrementUserStats(userId!, env, platform);

    const sec = ((Date.now() - start) / 1000).toFixed(1);
    finalText = `${finalText}\n\n🤖 ${result.model || 'Unknown'} | ⏱ ${sec}s`;
      const parts = splitLongText(finalText);

      // 5. Send Results
      if (platform === "whatsapp") {
        for (const part of parts) {
          await sendWhatsAppMessageSafe(whatsappPhoneId, senderId, part, token, env, replyToMsgId);
        }
      } else if (platform === "telegram") {
        for (const part of parts) {
          await sendTelegramMessage(Number(senderId), part, env, replyToMsgId as number);
        }
      } else if (platform === "line") {
        for (const part of parts) {
          await sendLineMessageSafe(senderId, part, token, replyToMsgId);
        }
      } else {
        for (const part of parts) {
          await sendMessageSafe(senderId, part, token, env, isThreads, replyToMsgId);
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
