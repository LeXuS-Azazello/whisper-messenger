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
      let buttons: any[] = [[{ text: "🔌 Connect Telegram", url: `${env.WORKER_URL}/dashboard` }]];

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


  const media = msg.voice || msg.audio || msg.video_note;
  if (media && msg.from) {
    const targetId = msg.from.id;
    const audioUrl = await getTelegramFileUrl(media.file_id, env);
    if (audioUrl) await env.AUDIO_QUEUE.send({ senderId: String(targetId), audioUrl, platform: "telegram", replyToMsgId: msg.message_id });
  }
  return new Response("ok");
}

export async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
  const isThreads = body.object === "threads";
  for (const entry of body.entry ?? []) {
    const pageId = entry.id;
    let ownerId = await env.STATS.get(`meta_page_owner_${pageId}`);
    let token = isThreads ? "" : (env.META_PAGE_TOKEN || ""); 

    // Fallback to system owner if not connected to a specific user
    if (!ownerId && env.META_SYSTEM_USER_ID) {
      ownerId = env.META_SYSTEM_USER_ID;
      token = env.META_SYSTEM_USER_TOKEN || token;
    }

    if (ownerId) {
      const userData = await env.STATS.get(`user_meta_${ownerId}`);
      if (userData) {
        const u: UserSession = JSON.parse(userData);
        if (isThreads && u.threadsToken) token = u.threadsToken;
        else if (!isThreads && u.metaToken) token = u.metaToken;
      }
    }
    
    // Safety check: if no token found, skip
    if (!token) continue;

    for (const msg of entry.messaging ?? []) {
      const senderId = msg.sender?.id || "";
      const audioUrl = msg.message?.attachments?.[0]?.payload?.url;
      if (senderId && audioUrl) {
        // Skip if page not connected to any user and no system fallback
        if (!ownerId) {
          console.log(`[webhooks] Skipping audio: page ${pageId} not connected to any user`);
          continue;
        }
        // Typing/Transcribing notification is handled in queue.ts
        let platform = body.object === "instagram" ? "instagram" : "messenger";
        if (isThreads) platform = "threads" as any;

        await env.AUDIO_QUEUE.send({ userId: ownerId, senderId, audioUrl, platform, replyToMsgId: msg.message?.mid });
      }
    }
  }
  return new Response("ok");
}

export async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneId = change.value.metadata?.phone_number_id || "";
      let ownerId = await env.STATS.get(`wa_phone_owner_${phoneId}`);
      let token = env.WHATSAPP_TOKEN || "";

      // Fallback to system owner
      if (!ownerId && env.META_SYSTEM_USER_ID) {
        ownerId = env.META_SYSTEM_USER_ID;
        token = env.META_SYSTEM_USER_TOKEN || token;
      }

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
            // Typing/Transcribing notification is handled in queue.ts
            await env.AUDIO_QUEUE.send({ userId: ownerId, senderId: msg.from, audioUrl, platform: "whatsapp", replyToMsgId: msg.id });
          }
        }
      }
    }
  }
  return new Response("ok");
}

export async function handleLine(body: any, userId: string, env: Env): Promise<Response> {
  const userData = await env.STATS.get(`user_meta_${userId}`);
  if (!userData) return new Response("User not found", { status: 404 });

  const u: UserSession = JSON.parse(userData);
  if (!u.lineToken) return new Response("LINE not configured", { status: 400 });

  for (const event of body.events ?? []) {
    if (event.type === "message" && event.message?.type === "audio") {
      const audioId = event.message.id;
      const senderId = event.source?.userId;
      const replyToken = event.message.quoteToken; // using quoteToken as replyToMsgId
      if (audioId && senderId) {
        // audioUrl for LINE will just be the audioId. We'll use platform="line" to know how to fetch it.
        await env.AUDIO_QUEUE.send({ 
          userId, 
          senderId, 
          audioUrl: audioId, 
          platform: "line", 
          replyToMsgId: replyToken 
        });
      }
    }
  }
  return new Response("ok");
}
