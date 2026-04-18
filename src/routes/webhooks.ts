import { Env, MetaWebhookBody, WhatsAppWebhookBody, UserSession } from "../types";
import { logError } from "../logger";
import { TelegramWebhookUpdate, sendTelegramTypingOn, sendTelegramMessage, getTelegramFileUrl, sendTelegramRichMessage } from "../telegram";
import { sendTypingOn, sendMessageSafe } from "../meta";
import { sendWhatsAppTypingOn, sendWhatsAppMessageSafe, getWhatsAppAudioUrl } from "../whatsapp";

export async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg || msg.chat.type !== "private") return new Response("ok");
  
  const text = msg.text?.trim() || "";
  const chatId = msg.chat.id;
  const userId = String(msg.from?.id);

  // Command Handling
  if (text.startsWith("/")) {
    if (text === "/start" || text === "/status") {
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (!userData) {
        await sendTelegramRichMessage(chatId, 
          `🚀 <b>Welcome to Echo Messenger!</b>\n\nTo start using the voice-to-text bridge, you need to connect your Telegram account. It's safe and takes 2 seconds.`, 
          env,
          {
            inline_keyboard: [[{ text: "🔌 Connect Telegram Now", url: `${env.WORKER_URL}/auth?auto=true` }]]
          }
        );
        return new Response("ok");
      }

      const user: UserSession = JSON.parse(userData);
      const isConnected = !!user.session;
      
      let status = "Not Connected";
      let buttons = [[{ text: "🔌 Connect Telegram", url: `${env.WORKER_URL}/dashboard` }]];

      if (isConnected) {
        // Fetch live status from bridge
        let liveStatus = "STOPPED";
        try {
          const res = await fetch(`${env.BRIDGE_URL}/pods`, {
            headers: { 'x-bridge-secret': env.BRIDGE_SECRET }
          });
          if (res.ok) {
            const pods: any[] = await res.json();
            const pod = pods.find(p => p.userId === userId);
            liveStatus = pod ? pod.status?.toUpperCase() : "STOPPED";
          }
        } catch (e) {}

        status = liveStatus === "RUNNING" ? "🟢 RUNNING" : `🔴 ${liveStatus}`;
        buttons = [
          [{ text: "🔄 Restart Bridge", callback_data: `restart_${userId}` }],
          [{ text: "⚙️ Dashboard & Settings", url: `${env.WORKER_URL}/dashboard` }]
        ];
      }

      await sendTelegramRichMessage(chatId, 
        `👤 <b>User Info</b>\nID: <code>${userId}</code>\nBridge Status: <b>${status}</b>\n\nYou can manage your bridge directly from here or via the dashboard.`,
        env,
        { inline_keyboard: buttons }
      );
      return new Response("ok");
    }

    if (text === "/restart") {
        const userData = await env.STATS.get(`user_meta_${userId}`);
        if (!userData || !JSON.parse(userData).session) {
            await sendTelegramMessage(chatId, "❌ You don't have a bridge connected yet. Use /start to begin.", env);
            return new Response("ok");
        }
        await sendTelegramMessage(chatId, "⏳ Restarting your bridge, please wait...", env);
        try {
            const session = await env.STATS.get(`tg_session_${userId}`);
            await fetch(`${env.BRIDGE_URL}/delete`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
                body: JSON.stringify({ userId })
            });
            await new Promise(r => setTimeout(r, 1000));
            await fetch(`${env.BRIDGE_URL}/spawn`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
                body: JSON.stringify({ userId, session })
            });
            await sendTelegramMessage(chatId, "✅ Bridge restarted successfully!", env);
        } catch (e: any) {
            await sendTelegramMessage(chatId, `❌ Restart failed: ${e.message}`, env);
        }
        return new Response("ok");
    }
  }

  await logError("telegram", `Msg from ${msg.from?.id}: ${msg.text || msg.voice ? '[voice]' : 'empty'}`, env);
  const media = msg.voice || msg.audio || msg.video_note;
  if (media && msg.from) {
    const targetId = msg.from.id;
    await sendTelegramTypingOn(targetId, env);
    await sendTelegramMessage(targetId, "⏳ Transcribing...", env);
    const audioUrl = await getTelegramFileUrl(media.file_id, env);
    if (audioUrl) await env.AUDIO_QUEUE.send({ senderId: String(targetId), audioUrl, platform: "telegram", replyToMsgId: msg.message_id });
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
        // Skip if page not connected to any user
        if (!ownerId) {
          console.log(`[webhooks] Skipping audio: page ${pageId} not connected to any user`);
          continue;
        }
        if (token) {
            await sendTypingOn(senderId, token, env);
            await sendMessageSafe(senderId, "⏳ Transcribing...", token, env);
        }
        let platform = body.object === "instagram" ? "instagram" : "messenger";
        if (isThreads) platform = "threads" as any;

        await env.AUDIO_QUEUE.send({ userId: ownerId, senderId, audioUrl, platform });
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
          // Skip if phone not connected to any user
          if (!ownerId) {
            console.log(`[webhooks] Skipping audio: phone ${phoneId} not connected to any user`);
            continue;
          }
          const audioUrl = await getWhatsAppAudioUrl(msg.audio.id, token, env);
          if (audioUrl) {
            await sendWhatsAppTypingOn(phoneId, msg.from, token, env);
            await sendWhatsAppMessageSafe(phoneId, msg.from, "⏳ Transcribing...", token, env);
            await env.AUDIO_QUEUE.send({ userId: ownerId, senderId: msg.from, audioUrl, platform: "whatsapp" });
          }
        }
      }
    }
  }
  return new Response("ok");
}

