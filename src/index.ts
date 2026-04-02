import { Env, AudioJob, MetaWebhookBody, WhatsAppWebhookBody } from "./types";
import { renderAdminDashboard, renderAdminLogin } from "./admin_ui";

import { sendMessageSafe, sendTypingOn, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn, getWhatsAppAudioUrl } from "./whatsapp";
import { sendTelegramMessage, sendTelegramTypingOn, getTelegramFileUrl, TelegramWebhookUpdate } from "./telegram";
import { verifyWebhook } from "./verify";
import queue from "./queue";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/health") {
      return health(env, req);
    }

    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(env, req);
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

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        console.error(`[webhook] Failed to parse JSON body: ${e}`);
        return new Response("Bad Request", { status: 400 });
      }

      const webhookObject = (body as { object?: string }).object;
      const isTelegram = !!(body as any).update_id;
      console.log(`[webhook] object="${webhookObject}" isTelegram=${isTelegram}`);

      // Telegram doesn't use X-Hub-Signature-256
      if (isTelegram) {
        return handleTelegram(body as unknown as TelegramWebhookUpdate, env);
      }

      // Meta (Messenger/Instagram/WhatsApp) verification
      const verifyError = await verifyWebhook(req, rawBody, env);
      if (verifyError) {
        return verifyError;
      }

      if (webhookObject === "whatsapp_business_account") {
        return handleWhatsApp(body as unknown as WhatsAppWebhookBody, env);
      }

      // "page" = Facebook Messenger, "instagram" = Instagram DMs
      if (webhookObject === "page" || webhookObject === "instagram") {
        return handleMetaMessaging(body as unknown as MetaWebhookBody, env);
      }

      console.warn(`[webhook] Unknown webhook object: "${webhookObject}"`);
      return new Response("ok");
    }

    return new Response("404");
  },

  queue,
} satisfies ExportedHandler<Env, AudioJob>;

async function handleAdmin(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieMatch = req.headers.get("Cookie")?.match(/(?:^| )auth=([^;]+)/);
  const cookieAuth = cookieMatch ? cookieMatch[1] : null;

  if (req.method === "POST" && url.pathname === "/admin/logout") {
    return new Response("Logged out", {
      status: 200,
      headers: { "Set-Cookie": "auth=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/" }
    });
  }

  if (req.method === "POST" && url.pathname === "/admin/login") {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    
    if (env.ADMIN_SECRET && password === env.ADMIN_SECRET) {
      return new Response("Redirecting...", {
        status: 302,
        headers: { 
          "Location": "/admin",
          "Set-Cookie": `auth=${password}; HttpOnly; Secure; SameSite=Strict; Max-Age=86400; Path=/` 
        }
      });
    }
    
    return new Response(renderAdminLogin("Invalid password"), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (!env.ADMIN_SECRET || cookieAuth !== env.ADMIN_SECRET) {
    return new Response(renderAdminLogin(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (req.method === "POST" && url.pathname === "/admin/setup-telegram") {
    if (!env.TELEGRAM_BOT_TOKEN) {
      return Response.json({ ok: false, description: "Missing TELEGRAM_BOT_TOKEN" }, { status: 400 });
    }
    const workerUrl = url.origin;
    const telegramUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${workerUrl}`;
    try {
      const res = await fetch(telegramUrl);
      const data = await res.json();
      return Response.json(data);
    } catch (err: any) {
      return Response.json({ ok: false, description: err.message }, { status: 500 });
    }
  }

  if (req.method === "POST" && url.pathname === "/admin/setup-meta") {
    if (!env.META_PAGE_TOKEN || !env.META_API_VERSION) {
      return Response.json({ ok: false, description: "Missing META_PAGE_TOKEN or META_API_VERSION" }, { status: 400 });
    }
    const metaUrl = `https://graph.facebook.com/${env.META_API_VERSION}/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks,messaging_optins&access_token=${env.META_PAGE_TOKEN}`;
    try {
      const res = await fetch(metaUrl, { method: 'POST' });
      const data = await res.json();
      return Response.json(data);
    } catch (err: any) {
      return Response.json({ ok: false, description: err.message }, { status: 500 });
    }
  }

  if (req.method === "POST" && url.pathname === "/admin/test-telegram") {
    try {
      const data: any = await req.json();
      const recipientId = data.recipientId;
      if (!env.TELEGRAM_BOT_TOKEN || !recipientId) return Response.json({ success: false, description: "Missing token or ID" }, { status: 400 });
      await sendTelegramMessage(recipientId, "🚀 Whisper Bot: Telegram Test Message", env);
      return Response.json({ success: true });
    } catch(err: any) {
      return Response.json({ success: false, description: err.message }, { status: 500 });
    }
  }

  if (req.method === "POST" && url.pathname === "/admin/test-meta") {
    try {
      const data: any = await req.json();
      const recipientId = data.recipientId;
      if (!env.META_PAGE_TOKEN || !recipientId) return Response.json({ success: false, description: "Missing token or ID" }, { status: 400 });
      await sendMessageSafe(recipientId, "🚀 Whisper Bot: Meta Test Message", env);
      return Response.json({ success: true });
    } catch(err: any) {
      return Response.json({ success: false, description: err.message }, { status: 500 });
    }
  }

  if (req.method === "POST" && url.pathname === "/admin/test-whatsapp") {
    try {
      const data: any = await req.json();
      const recipientId = data.recipientId;
      if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !recipientId) return Response.json({ success: false, description: "Missing token or ID" }, { status: 400 });
      await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, recipientId, "🚀 Whisper Bot: WhatsApp Test Message", env);
      return Response.json({ success: true });
    } catch(err: any) {
      return Response.json({ success: false, description: err.message }, { status: 500 });
    }
  }

  const checks = getHealthChecks(env);
  const stats = await getStats(env);
  return new Response(renderAdminDashboard(checks, env, url.origin, stats), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function getStats(env: Env) {
  const p = ["messenger", "instagram", "whatsapp", "telegram"];
  const res: any = {};
  for (const platform of p) {
    const val = await env.STATS.get(`stats_${platform}`);
    res[platform] = parseInt(val || "0", 10);
  }
  return res;
}

function getHealthChecks(env: Env) {
  return {
    VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
    META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
    META_APP_SECRET: Boolean(env.META_APP_SECRET),
    WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
    META_API_VERSION: Boolean(env.META_API_VERSION),
    WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    TELEGRAM_BOT_TOKEN: Boolean(env.TELEGRAM_BOT_TOKEN),
    TELEGRAM_CHAT_ID: Boolean(env.TELEGRAM_CHAT_ID),
    AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
    AI: Boolean(env.AI),
  };
}

function health(env: Env, req?: Request): Response {
  const checks = getHealthChecks(env);
  const ok = Object.values(checks).every(Boolean);

  return Response.json(
    {
      ok,
      service: "whisper-messenger",
      checks,
    },
    { status: ok ? 200 : 500 }
  );
}

async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
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
}

async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
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
}

async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg) return new Response("ok");

  const chatId = msg.chat.id;
  const voice = msg.voice || msg.audio;

  console.log(`[telegram] message from chat "${chatId}" hasVoice=${!!voice}`);

  if (voice) {
    await sendTelegramTypingOn(chatId, env);
    await sendTelegramMessage(chatId, "⏳ Transcribing your voice message...", env);

    const audioUrl = await getTelegramFileUrl(voice.file_id, env);
    if (!audioUrl) {
      await sendTelegramMessage(chatId, "❌ Could not fetch audio from Telegram", env);
      return new Response("ok");
    }

    const job: AudioJob = {
      senderId: String(chatId),
      audioUrl,
      platform: "telegram",
    };

    console.log(`[telegram] Enqueuing job: chatId=${chatId}`);
    await env.AUDIO_QUEUE.send(job);
  }

  return new Response("ok");
}

