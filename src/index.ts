import { Env, AudioJob, MetaWebhookBody, WhatsAppWebhookBody } from "./types";
import { sendMessageSafe, sendTypingOn } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn, getWhatsAppAudioUrl } from "./whatsapp";
import queue from "./queue";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // WhatsApp webhook verification
    if (req.method === "GET") {
      if (url.searchParams.get("hub.verify_token") === env.VERIFY_TOKEN) {
        return new Response(url.searchParams.get("hub.challenge"));
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method === "POST") {
      const body = await req.json() as Record<string, unknown>;
      
      // Check if it's a WhatsApp webhook (has entry[].changes)
      const isWhatsApp = (body as unknown as WhatsAppWebhookBody).entry?.[0]?.changes?.[0]?.value?.messaging;
      
      if (isWhatsApp) {
        return this.handleWhatsApp(body as unknown as WhatsAppWebhookBody, env);
      }
      
      // Otherwise treat as Instagram/Facebook Messenger webhook
      return this.handleMessenger(body as unknown as MetaWebhookBody, env);
    }

    return new Response("404");
  },

  async handleMessenger(body: MetaWebhookBody, env: Env): Promise<Response> {
    const msg = body.entry?.[0]?.messaging?.[0];

    if (!msg) return new Response("ok");

    const senderId = msg.sender.id;
    const att = msg.message?.attachments?.[0];

    if (att?.type === "audio") {
      await sendTypingOn(senderId, env);
      await sendMessageSafe(senderId, "*transcribe in progress*", env);

      const job: AudioJob = {
        senderId,
        audioUrl: att.payload.url,
        platform: "messenger",
      };

      await env.AUDIO_QUEUE.send(job);
    }

    return new Response("ok");
  },

  async handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
    const msg = body.entry?.[0]?.changes?.[0]?.value?.messaging?.[0];

    if (!msg) return new Response("ok");

    const from = msg.from;
    const audio = msg.message?.audio;

    if (audio) {
      await sendWhatsAppTypingOn(env.WHATSAPP_PHONE_NUMBER_ID, from, env);
      await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, from, "*transcribing...*", env);

      // Get audio URL from WhatsApp
      const audioUrl = await getWhatsAppAudioUrl(audio.id, env);
      
      if (!audioUrl) {
        await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, from, "Could not fetch audio", env);
        return new Response("ok");
      }

      const job: AudioJob = {
        senderId: from,
        audioUrl,
        platform: "whatsapp",
      };

      await env.AUDIO_QUEUE.send(job);
    }

    return new Response("ok");
  },

  queue,
};
