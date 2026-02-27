import { Env, AudioJob, MetaWebhookBody, WhatsAppWebhookBody } from "./types";
import { sendMessageSafe, sendTypingOn, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn, getWhatsAppAudioUrl } from "./whatsapp";
import { verifyWebhook } from "./verify";
import queue from "./queue";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return this.health(env);
    }

    // Webhook verification (shared by all Meta platforms)
    if (req.method === "GET") {
      const verifyToken = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      console.log(`[webhook] GET verify_token=${verifyToken} challenge=${challenge}`);

      if (verifyToken === env.VERIFY_TOKEN) {
        return new Response(challenge);
      }
      return new Response("Forbidden", { status: 403 });
    }

    if (req.method === "POST") {
      const rawBody = await req.text();
      console.log(`[webhook] POST raw body: ${rawBody}`);

      // Verify webhook authenticity (mTLS + X-Hub-Signature-256)
      const verifyError = await verifyWebhook(req, rawBody, env);
      if (verifyError) {
        return verifyError;
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error(`[webhook] Failed to parse JSON body: ${e}`);
        return new Response("Bad Request", { status: 400 });
      }

      const webhookObject = (body as { object?: string }).object;
      console.log(`[webhook] object="${webhookObject}"`);

      if (webhookObject === "whatsapp_business_account") {
        return this.handleWhatsApp(body as unknown as WhatsAppWebhookBody, env);
      }

      // "page" = Facebook Messenger, "instagram" = Instagram DMs
      if (webhookObject === "page" || webhookObject === "instagram") {
        return this.handleMetaMessaging(body as unknown as MetaWebhookBody, env);
      }

      console.warn(`[webhook] Unknown webhook object: "${webhookObject}"`);
      return new Response("ok");
    }

    return new Response("404");
  },

  health(env: Env): Response {
    const checks = {
      VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
      META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
      META_APP_SECRET: Boolean(env.META_APP_SECRET),
      WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
      META_API_VERSION: Boolean(env.META_API_VERSION),
      WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
      AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
      AI: Boolean(env.AI),
    };

    const ok = Object.values(checks).every(Boolean);

    return Response.json(
      {
        ok,
        service: "whisper-messenger",
        checks,
      },
      { status: ok ? 200 : 500 }
    );
  },

  async handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
    const platform: AudioJob["platform"] = body.object === "instagram" ? "instagram" : "messenger";
    console.log(`[meta] handleMetaMessaging platform="${platform}" entries=${body.entry?.length ?? 0}`);

    for (const entry of body.entry ?? []) {
      console.log(`[meta] entry id=${(entry as any).id} messaging count=${entry.messaging?.length ?? 0}`);

      for (const msg of entry.messaging ?? []) {
        const senderId = msg.sender?.id;
        const messageObj = msg.message;
        const att = messageObj?.attachments?.[0];

        console.log(`[meta] message from senderId="${senderId}" hasMessage=${!!messageObj} attachments=${messageObj?.attachments?.length ?? 0}`);

        if (!senderId) {
          console.warn(`[meta] Skipping: no senderId`);
          continue;
        }

        if (!messageObj) {
          console.log(`[meta] Skipping: no message object (could be delivery/read receipt)`);
          continue;
        }

        if (!att) {
          console.log(`[meta] Skipping: no attachments`);
          continue;
        }

        console.log(`[meta] attachment type="${att.type}" url="${att.payload?.url?.substring(0, 80)}..."`);

        if (att.type !== "audio") {
          console.log(`[meta] Skipping: attachment type is "${att.type}", not audio`);
          continue;
        }

        if (!att.payload?.url) {
          console.warn(`[meta] Skipping: audio attachment has no URL`);
          continue;
        }

        // Try to notify the user; if they can't be messaged, skip the job entirely
        try {
          await sendTypingOn(senderId, env);
          await sendMessageSafe(senderId, "⏳ Transcribing your voice message...", env);
        } catch (e) {
          if (e instanceof MetaNonRetryableError) {
            console.warn(`[meta] Cannot message user ${senderId} (subcode=${e.errorSubcode}), skipping job`);
            continue;
          }
          throw e; // re-throw unexpected errors
        }

        const job: AudioJob = {
          senderId,
          audioUrl: att.payload.url,
          platform,
        };

        console.log(`[meta] Enqueuing job: platform=${platform} senderId=${senderId}`);
        await env.AUDIO_QUEUE.send(job);
      }
    }

    return new Response("ok");
  },

  async handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
    console.log(`[whatsapp] handleWhatsApp entries=${body.entry?.length ?? 0}`);

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const messages = change.value.messages ?? [];
        const statuses = (change.value as any).statuses;

        console.log(`[whatsapp] change: messages=${messages.length} statuses=${statuses?.length ?? 0}`);

        for (const msg of messages) {
          const from = msg.from;
          const audio = msg.audio;

          console.log(`[whatsapp] message from="${from}" type="${msg.type ?? 'unknown'}" hasAudio=${!!audio}`);

          if (!from || !audio) {
            console.log(`[whatsapp] Skipping: no from or no audio`);
            continue;
          }

          await sendWhatsAppTypingOn(env.WHATSAPP_PHONE_NUMBER_ID, from, env);
          await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, from, "⏳ Transcribing your voice message...", env);

          // Get audio URL from WhatsApp
          const audioUrl = await getWhatsAppAudioUrl(audio.id, env);
          console.log(`[whatsapp] audioUrl for id=${audio.id}: ${audioUrl?.substring(0, 80) ?? 'null'}`);

          if (!audioUrl) {
            await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, from, "❌ Could not fetch audio", env);
            continue;
          }

          const job: AudioJob = {
            senderId: from,
            audioUrl,
            platform: "whatsapp",
          };

          console.log(`[whatsapp] Enqueuing job: from=${from}`);
          await env.AUDIO_QUEUE.send(job);
        }
      }
    }

    return new Response("ok");
  },

  queue,
};
