import { Env, AudioJob } from "./types";
import { transcribeWithFallback } from "./whisper";
import { sendMessageSafe } from "./meta";
import { sendWhatsAppMessageSafe } from "./whatsapp";
import { splitLongText } from "./text";

export default {
  async queue(
    batch: MessageBatch<AudioJob>,
    env: Env
  ): Promise<void> {
    for (const msg of batch.messages) {
      const { senderId, audioUrl, platform } = msg.body;

      const start = Date.now();

      try {
        // Download audio
        const audioRes = await fetch(audioUrl);
        const audioBuffer = await audioRes.arrayBuffer();

        // Transcribe with Whisper
        const result = await transcribeWithFallback(audioBuffer, env);

        const sec = ((Date.now() - start) / 1000).toFixed(1);

        const finalText = `*${result.text}*\n\ngen. time: ${sec} sec`;

        // Chunk long text and send
        const parts = splitLongText(finalText);

        if (platform === "whatsapp") {
          for (const part of parts) {
            await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, senderId, part, env);
          }
        } else {
          for (const part of parts) {
            await sendMessageSafe(senderId, part, env);
          }
        }

        msg.ack();
      } catch (e) {
        // Retry - Cloudflare Queues will handle retries
        msg.retry();
      }
    }
  },
};
