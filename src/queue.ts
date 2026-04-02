import { Env, AudioJob } from "./types";
import { transcribeWithFallback } from "./whisper";
import { sendMessageSafe, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe } from "./whatsapp";
import { sendTelegramMessage } from "./telegram";
import { splitLongText } from "./text";

export default async function queue(
  batch: MessageBatch<AudioJob>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    const { senderId, audioUrl, platform } = msg.body;

    console.log(`[queue] Processing job: platform=${platform} senderId=${senderId} audioUrl=${audioUrl.substring(0, 80)}...`);

    const start = Date.now();

    try {
      // WhatsApp media URLs require bearer auth for download.
      // Meta (Messenger/Instagram) attachment URLs are CDN links that don't need auth.
      const fetchOptions: RequestInit | undefined = platform === "whatsapp"
        ? {
            headers: {
              Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
            },
          }
        : undefined;

      console.log(`[queue] Downloading audio (platform=${platform}, withAuth=${platform === "whatsapp"})...`);
      const audioRes = await fetch(audioUrl, fetchOptions);

      if (!audioRes.ok) {
        const errorBody = await audioRes.text();
        console.error(`[queue] Audio download failed: status=${audioRes.status} body=${errorBody}`);
        throw new Error(`Audio download failed: ${audioRes.status} ${errorBody}`);
      }

      const audioBuffer = await audioRes.arrayBuffer();
      const contentType = audioRes.headers.get("content-type") ?? "unknown";
      console.log(`[queue] Audio downloaded: ${audioBuffer.byteLength} bytes, content-type=${contentType}`);

      // Transcribe with Whisper
      console.log(`[queue] Starting Whisper transcription...`);
      const result = await transcribeWithFallback(audioBuffer, env);
      console.log(`[queue] Transcription result: "${result.text.substring(0, 100)}..."`);

      const sec = ((Date.now() - start) / 1000).toFixed(1);

      const finalText = `${result.text}\n\n⏱ ${sec}s`;

      // Chunk long text and send
      const parts = splitLongText(finalText);

      if (platform === "whatsapp") {
        for (const part of parts) {
          await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, senderId, part, env);
        }
      } else if (platform === "telegram") {
        for (const part of parts) {
          await sendTelegramMessage(senderId, part, env);
        }
      } else {
        for (const part of parts) {
          await sendMessageSafe(senderId, part, env);
        }
      }

      console.log(`[queue] Job completed successfully: platform=${platform} senderId=${senderId}`);
      
      // Increment stats
      try {
        const statsKey = `stats_${platform}`;
        const currentStr = await env.STATS.get(statsKey);
        const current = parseInt(currentStr || "0", 10);
        await env.STATS.put(statsKey, (current + 1).toString());
      } catch (statsErr) {
        console.error(`[queue] Failed to update stats: ${statsErr}`);
      }

      msg.ack();
    } catch (e) {
      // Non-retryable: user can't be messaged (blocked, window expired, etc.)
      if (e instanceof MetaNonRetryableError) {
        console.warn(`[queue] Non-retryable error, acking job: platform=${platform} senderId=${senderId} subcode=${e.errorSubcode} message=${e.message}`);
        msg.ack();
        continue;
      }

      console.error(`[queue] Job failed: platform=${platform} senderId=${senderId} error=${e}`);
      // Retry - Cloudflare Queues will handle retries
      msg.retry();
    }
  }
}
