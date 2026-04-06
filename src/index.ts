import { renderAdminDashboard, renderAdminLogin } from "./admin_ui";
import { renderAuthPage } from "./auth_ui";
import { renderDashboard } from "./dashboard_ui";
import { renderHomePage } from "./home_ui";
import { Env, UserSession, AudioJob, MetaWebhookBody, WhatsAppWebhookBody } from "./types";

import { sendMessageSafe, sendTypingOn, MetaNonRetryableError } from "./meta";
import { sendWhatsAppMessageSafe, sendWhatsAppTypingOn, getWhatsAppAudioUrl } from "./whatsapp";
import { sendTelegramMessage, sendTelegramTypingOn, getTelegramFileUrl, TelegramWebhookUpdate } from "./telegram";
import { verifyWebhook } from "./verify";
import { logError, getErrors } from "./logger";
import queue from "./queue";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") return Response.json({ ok: true });
    
    if (url.pathname === "/") {
        return new Response(renderHomePage(env.GOOGLE_CLIENT_ID), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Public Auth Routes
    if (url.pathname.startsWith("/auth")) {
      return handlePublicAuth(env, req);
    }

    // Admin Routes
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(env, req);
    }

    // User Dashboard Routes
    if (url.pathname.startsWith("/dashboard")) {
      return handleUserDashboard(env, req);
    }

    // Internal Stats (called by Bridge User Pods)
    if (url.pathname === "/internal/stats" && req.method === "POST") {
      const { userId, secret } = await req.json() as any;
      if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
      await incrementUserStats(userId, env);
      return Response.json({ ok: true });
    }
    
    if (url.pathname === "/internal/user-meta" && req.method === "GET") {
      const userId = url.searchParams.get("userId");
      const secret = url.searchParams.get("secret");
      if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
      const data = await env.STATS.get(`user_meta_${userId}`);
      return new Response(data, { headers: { "Content-Type": "application/json" } });
    }

    // Standard Webhooks (Meta, WhatsApp, Telegram Bot)
    if (req.method === "POST") {
      const rawBody = await req.text();
      let body: any;
      try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

      const isTelegram = !!body.update_id;
      if (isTelegram) {
        return handleTelegram(body, env);
      }

      const verifyError = await verifyWebhook(req, rawBody, env);
      if (verifyError) return verifyError;

      if (body.object === "whatsapp_business_account") return handleWhatsApp(body, env);
      if (body.object === "page" || body.object === "instagram") return handleMetaMessaging(body, env);

      return new Response("ok");
    }

    return new Response("404");
  },

  queue,
} satisfies ExportedHandler<Env>;

async function handlePublicAuth(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const bridgeUrl = env.BRIDGE_URL;

  if (req.method === "GET" && url.pathname === "/auth") {
    return new Response(renderAuthPage(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Auth flow endpoints
  if (req.method === "POST" && url.pathname === "/auth/qr-start") {
    return fetch(`${bridgeUrl}/qr-start`, {
      method: "POST", headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
  }

  // Phone Auth Flow
  if (req.method === "POST" && url.pathname === "/auth/send-code") {
    const { phone } = await req.json() as any;
    return fetch(`${bridgeUrl}/send-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone })
    });
  }

  if (req.method === "POST" && url.pathname === "/auth/verify-code") {
    const { phone, code } = await req.json() as any;
    const userCookie = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
    const res = await fetch(`${bridgeUrl}/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone, code })
    });
    const data: any = await res.json();
    if (data.success) {
      await registerNewUser(data, env, userCookie);
    }
    return Response.json(data);
  }

  if (req.method === "GET" && url.pathname === "/auth/qr-check") {
    const token = url.searchParams.get("token");
    const userCookie = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
    const res = await fetch(`${bridgeUrl}/qr-check?token=${token}`, {
      headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
    const data: any = await res.json();
    if (data.done) {
      await registerNewUser(data, env, userCookie);
    }
    return Response.json(data);
  }

  if (req.method === "POST" && url.pathname === "/auth/google/callback") {
    const formData = await req.formData();
    const idToken = formData.get("credential")?.toString();
    if (!idToken) return new Response("Missing credential", { status: 400 });

    // Decode JWT from Google (base64 part 1=header, 2=payload)
    try {
      const payloadBase64 = idToken.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      
      // In prod, check audience: if (payload.aud !== env.GOOGLE_CLIENT_ID) throw new Error("Invalid aud");
      
      const userId = `google_${payload.sub}`;
      const existingRaw = await env.STATS.get(`user_meta_${userId}`);
      if (!existingRaw) {
          const user: UserSession = {
              userId, firstName: payload.given_name || payload.name,
              session: "", platform: "telegram", transcriptionCount: 0,
              isActive: false, createdAt: Date.now(), lastActiveAt: Date.now()
          };
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
          
          const listRaw = await env.STATS.get("users_list");
          const list: string[] = listRaw ? JSON.parse(listRaw) : [];
          if (!list.includes(userId)) {
            list.push(userId);
            await env.STATS.put("users_list", JSON.stringify(list));
          }
      }
      
      return new Response("Redirecting...", {
        status: 302, headers: { 
            "Location": "/dashboard",
            "Set-Cookie": `user_id=${userId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` 
        }
      });
    } catch (e) {
      return new Response("Auth Error: " + (e as Error).message, { status: 500 });
    }
  }

  return new Response("Not found", { status: 404 });
}

async function registerNewUser(data: any, env: Env, existingUserId?: string) {
  const { userId: tgUserId, firstName, session } = data;
  const targetUserId = existingUserId || tgUserId;
  const existingRaw = await env.STATS.get(`user_meta_${targetUserId}`);
  let user: UserSession;

  if (existingRaw) {
    user = JSON.parse(existingRaw);
    user.session = session;
    // user.firstName = firstName; // Keep existing name if google
    user.lastActiveAt = Date.now();
    user.isActive = true;
  } else {
    user = {
      userId: targetUserId, firstName, session,
      platform: "telegram", createdAt: Date.now(), lastActiveAt: Date.now(),
      isActive: true, transcriptionCount: 0
    };
    const listRaw = await env.STATS.get("users_list");
    const list: string[] = listRaw ? JSON.parse(listRaw) : [];
    if (!list.includes(targetUserId)) {
      list.push(targetUserId);
      await env.STATS.put("users_list", JSON.stringify(list));
    }
  }
  
  await env.STATS.put(`user_meta_${targetUserId}`, JSON.stringify(user));
  await env.STATS.put(`tg_session_${targetUserId}`, session);

  await fetch(`${env.BRIDGE_URL}/spawn`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
    body: JSON.stringify({ userId: targetUserId, session })
  }).catch(() => {});
}

async function handleUserDashboard(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];

  if (!userId) {
    return new Response(null, { status: 302, headers: { "Location": "/auth" } });
  }

  const userData = await env.STATS.get(`user_meta_${userId}`);
  if (!userData) {
    return new Response(null, { status: 302, headers: { "Location": "/auth" } });
  }
  const user: UserSession = JSON.parse(userData);

  if (req.method === "POST") {
    if (url.pathname === "/dashboard/save-meta") {
      const { metaToken } = await req.json() as any;
      user.metaToken = metaToken;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/save-wa") {
      const { whatsappToken, whatsappPhoneId } = await req.json() as any;
      user.whatsappToken = whatsappToken;
      user.whatsappPhoneId = whatsappPhoneId;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/test-tg") {
      const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId })
      });
      return Response.json({ success: res.ok });
    }
    if (url.pathname === "/dashboard/test-meta") {
      const { recipientId } = await req.json() as any;
      if (!user.metaToken) return Response.json({ error: "No token" }, { status: 400 });
      const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me/messages?access_token=${user.metaToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: { id: recipientId }, message: { text: "Whisper Test ✅" } })
      });
      return Response.json({ success: res.ok });
    }
    if (url.pathname === "/dashboard/test-wa") {
      const { recipientId } = await req.json() as any;
      if (!user.whatsappToken || !user.whatsappPhoneId) return Response.json({ error: "Missing config" }, { status: 400 });
      const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/${user.whatsappPhoneId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.whatsappToken}` },
        body: JSON.stringify({ messaging_product: "whatsapp", to: recipientId, type: "text", text: { body: "Whisper Test ✅" } })
      });
      return Response.json({ success: res.ok });
    }
    if (url.pathname === "/dashboard/disconnect-tg") {
      await fetch(`${env.BRIDGE_URL}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId })
      });
      user.session = "";
      user.isActive = false;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      await env.STATS.delete(`tg_session_${userId}`);
      return Response.json({ success: true });
    }
  }

  return new Response(renderDashboard(user), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function incrementUserStats(userId: string, env: Env) {
  // 1. Global TG Stats
  const global = await env.STATS.get("stats_telegram");
  await env.STATS.put("stats_telegram", String(parseInt(global || "0", 10) + 1));

  // 2. Per-user Stats
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    const meta: UserSession = JSON.parse(metaRaw);
    meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
    meta.lastActiveAt = Date.now();
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
  }
}

async function handleAdmin(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieAuth = req.headers.get("Cookie")?.match(/auth=([^;]+)/)?.[1];

  if (req.method === "POST" && url.pathname === "/admin/login") {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    if (password === env.ADMIN_SECRET) {
      return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `auth=${password}; Path=/; HttpOnly` } });
    }
    return new Response(renderAdminLogin("Invalid password"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  if (cookieAuth !== env.ADMIN_SECRET) return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  const bridgeUrl = env.BRIDGE_URL;

  // Admin Telegram Status
  if (req.method === "GET" && url.pathname === "/admin/tg-status") {
    const adminSession = await env.STATS.get("admin_tg_session");
    if (!adminSession) return Response.json({ authenticated: false });
    // Try to get user info if session exists
    const adminUserId = await env.STATS.get("admin_tg_user_id");
    return Response.json({ authenticated: true, userId: adminUserId });
  }

  if (req.method === "POST" && url.pathname === "/admin/tg-logout") {
    const adminUserId = await env.STATS.get("admin_tg_user_id");
    if (adminUserId) {
        await fetch(`${bridgeUrl}/delete`, {
            method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
            body: JSON.stringify({ userId: adminUserId })
        });
    }
    await env.STATS.delete("admin_tg_session");
    await env.STATS.delete("admin_tg_user_id");
    return Response.json({ success: true });
  }

  // Admin Telegram Auth Proxy
  if (req.method === "POST" && url.pathname === "/admin/tg-qr-login") {
    return fetch(`${bridgeUrl}/qr-start`, { method: "POST", headers: { "x-bridge-secret": env.BRIDGE_SECRET } });
  }
  if (req.method === "GET" && url.pathname === "/admin/tg-qr-check") {
    const token = url.searchParams.get("token");
    const res = await fetch(`${bridgeUrl}/qr-check?token=${token}`, { headers: { "x-bridge-secret": env.BRIDGE_SECRET } });
    const data: any = await res.json();
    if (data.done) {
        await registerNewUser(data, env);
        await env.STATS.put("admin_tg_session", data.session);
        await env.STATS.put("admin_tg_user_id", data.userId);
    }
    return Response.json({ authenticated: data.done });
  }
  if (req.method === "POST" && url.pathname === "/admin/tg-send-code") {
    const { phoneNumber } = await req.json() as any;
    const res = await fetch(`${bridgeUrl}/send-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber })
    });
    return Response.json({ success: res.ok });
  }
  if (req.method === "POST" && url.pathname === "/admin/tg-verify-code") {
    const { phoneNumber, code } = await req.json() as any;
    const res = await fetch(`${bridgeUrl}/verify-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber, code })
    });
    const data: any = await res.json();
    if (data.success) {
        await registerNewUser(data, env);
        await env.STATS.put("admin_tg_session", data.session);
        await env.STATS.put("admin_tg_user_id", data.userId);
    }
    return Response.json(data);
  }

  if (req.method === "POST" && url.pathname === "/admin/tg-test-msg") {
    const adminUserId = await env.STATS.get("admin_tg_user_id");
    if (!adminUserId) return Response.json({ error: "Not auth" }, { status: 400 });
    const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId: adminUserId })
    });
    return Response.json({ success: res.ok });
  }

  // Handle User Management Actions
  if (req.method === "POST" && url.pathname === "/admin/user-action") {
    const { userId, action } = await req.json() as any;
    if (action === "stop" || action === "delete") {
      await fetch(`${env.BRIDGE_URL}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId })
      });
      const metaRaw = await env.STATS.get(`user_meta_${userId}`);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        meta.isActive = false;
        if (action === "delete") {
            // Full deletion logic could be here
        }
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
      }
    }
    return Response.json({ success: true });
  }

  // Load stats and users
  const userIdsRaw = await env.STATS.get("users_list");
  const userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];
  const users: UserSession[] = [];
  for (const id of userIds) {
    const meta = await env.STATS.get(`user_meta_${id}`);
    if (meta) users.push(JSON.parse(meta));
  }

  const checks = {
    VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
    META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
    META_APP_SECRET: Boolean(env.META_APP_SECRET),
    WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
    META_API_VERSION: Boolean(env.META_API_VERSION),
    WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    TELEGRAM_APP_ID: Boolean(env.TELEGRAM_APP_ID),
    TELEGRAM_APP_HASH: Boolean(env.TELEGRAM_APP_HASH),
    AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
    AI: Boolean(env.AI),
  };

  const platforms = ["messenger", "instagram", "whatsapp", "telegram"];
  const stats: any = {};
  for (const p of platforms) {
    const val = await env.STATS.get(`stats_${p}`);
    stats[p] = parseInt(val || "0", 10);
  }
  
  const errors = await getErrors(env);

  return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

// ─── Platform Handlers (Restored) ───

async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg) return new Response("ok");
  const chatId = msg.chat.id;
  const voice = msg.voice || msg.audio;
  if (voice) {
    await sendTelegramTypingOn(chatId, env);
    await sendTelegramMessage(chatId, "⏳ Transcribing...", env);
    const audioUrl = await getTelegramFileUrl(voice.file_id, env);
    if (!audioUrl) return new Response("ok");
    await env.AUDIO_QUEUE.send({ senderId: String(chatId), audioUrl, platform: "telegram" });
  }
  return new Response("ok");
}

async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
  for (const entry of body.entry ?? []) {
    for (const msg of entry.messaging ?? []) {
      const senderId = msg.sender?.id;
      const audioUrl = msg.message?.attachments?.[0]?.payload?.url;
      if (senderId && audioUrl) {
         await sendTypingOn(senderId, env);
         await sendMessageSafe(senderId, "⏳ Transcribing...", env);
         await env.AUDIO_QUEUE.send({ senderId, audioUrl, platform: body.object === "instagram" ? "instagram" : "messenger" });
      }
    }
  }
  return new Response("ok");
}

async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value.messages ?? []) {
        if (msg.from && msg.audio) {
          const audioUrl = await getWhatsAppAudioUrl(msg.audio.id, env);
          if (audioUrl) {
            await sendWhatsAppTypingOn(env.WHATSAPP_PHONE_NUMBER_ID, msg.from, env);
            await sendWhatsAppMessageSafe(env.WHATSAPP_PHONE_NUMBER_ID, msg.from, "⏳ Transcribing...", env);
            await env.AUDIO_QUEUE.send({ senderId: msg.from, audioUrl, platform: "whatsapp" });
          }
        }
      }
    }
  }
  return new Response("ok");
}
