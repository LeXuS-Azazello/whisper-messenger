import { Env, MetaWebhookBody, WhatsAppWebhookBody, UserSession } from "../types";
import { TelegramWebhookUpdate, sendTelegramTypingOn, sendTelegramMessage, getTelegramFileUrl } from "../telegram";
import { sendTypingOn, sendMessageSafe } from "../meta";
import { sendWhatsAppTypingOn, sendWhatsAppMessageSafe, getWhatsAppAudioUrl } from "../whatsapp";

export async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg) return new Response("ok");
  const media = msg.voice || msg.audio || msg.video_note;
  if (media) {
    await sendTelegramTypingOn(msg.chat.id, env);
    await sendTelegramMessage(msg.chat.id, "⏳ Transcribing...", env);
    const audioUrl = await getTelegramFileUrl(media.file_id, env);
    if (audioUrl) await env.AUDIO_QUEUE.send({ senderId: String(msg.chat.id), audioUrl, platform: "telegram" });
  }
  return new Response("ok");
}

export async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
  const isThreads = body.object === "threads";
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;
    const ownerId = await env.STATS.get(`meta_page_owner_${pageId}`);
    let token = isThreads ? "" : (env.META_PAGE_TOKEN || ""); 

    if (ownerId) {
      const userData = await env.STATS.get(`user_meta_${ownerId}`);
      if (userData) {
        const u: UserSession = JSON.parse(userData);
        if (isThreads && u.threadsToken) token = u.threadsToken;
        else if (!isThreads && u.metaToken) token = u.metaToken;
      }
    }
    
    // Safety check: if no token found and it's a tenant message, skip
    if (!token && ownerId) continue;

    for (const msg of entry.messaging ?? []) {
      const senderId = msg.sender?.id || "";
      const audioUrl = msg.message?.attachments?.[0]?.payload?.url;
      if (senderId && audioUrl) {
         if (token) {
             await sendTypingOn(senderId, token, env);
             await sendMessageSafe(senderId, "⏳ Transcribing...", token, env);
         }
         let platform = body.object === "instagram" ? "instagram" : "messenger";
         if (isThreads) platform = "threads" as any;

         await env.AUDIO_QUEUE.send({ userId: ownerId || undefined, senderId, audioUrl, platform });
      }
    }
  }
  return new Response("ok");
}

export async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneId = change.value.metadata?.phone_number_id || "";
      const ownerId = await env.STATS.get(`wa_phone_owner_${phoneId}`);
      let token = env.WHATSAPP_TOKEN || "";

      if (ownerId) {
        const userData = await env.STATS.get(`user_meta_${ownerId}`);
        if (userData) {
          const u: UserSession = JSON.parse(userData);
          if (u.whatsappToken) token = u.whatsappToken;
        }
      }

      for (const msg of change.value.messages ?? []) {
        if (msg.from && msg.audio) {
          const audioUrl = await getWhatsAppAudioUrl(msg.audio.id, token, env);
          if (audioUrl) {
            await sendWhatsAppTypingOn(phoneId, msg.from, token, env);
            await sendWhatsAppMessageSafe(phoneId, msg.from, "⏳ Transcribing...", token, env);
            await env.AUDIO_QUEUE.send({ userId: ownerId || undefined, senderId: msg.from, audioUrl, platform: "whatsapp" });
          }
        }
      }
    }
  }
  return new Response("ok");
}

