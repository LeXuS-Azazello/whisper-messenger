import { renderAdminDashboard, renderAdminLogin } from "./admin_ui";
import { renderAuthPage } from "./auth_ui";
import { renderDashboard } from "./dashboard_ui";
import { renderHome } from "./home_ui";
import { Env, UserSession, AudioJob, MetaWebhookBody, WhatsAppWebhookBody, HealthChecks } from "./types";

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
    
    const userCookie = req.headers.get('Cookie')?.match(/user_id=([^;]+)/)?.[1];

    if (url.pathname === "/") {
        if (userCookie) return Response.redirect(`${url.origin}/dashboard`);
        return new Response(renderHome(env.GOOGLE_CLIENT_ID), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/auth" && userCookie) {
        return Response.redirect(`${url.origin}/dashboard`);
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

    if (url.pathname === "/test-whisper" && req.method === "POST") {
        const provider = url.searchParams.get("provider") as "cloudflare" | "local" || "cloudflare";
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) return new Response("Missing file", { status: 400 });
        
        try {
            const buffer = await file.arrayBuffer();
            
            // Temporary override just for this test
            const originalProvider = await env.STATS.get("config_whisper_provider");
            await env.STATS.put("config_whisper_provider", provider);
            
            const start = Date.now();
            const { transcribeWithFallback } = await import("./whisper");
            const result = await transcribeWithFallback(buffer, env);
            const elapsed = (Date.now() - start) / 1000;
            
            // Restore provider
            if (originalProvider) await env.STATS.put("config_whisper_provider", originalProvider);
            
            return Response.json({ success: true, provider, elapsed, text: result.text });
        } catch (e) {
            return Response.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
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
      if (body.object === "page" || body.object === "instagram" || body.object === "threads") return handleMetaMessaging(body, env);

      return new Response("ok");
    }

    return new Response("404");
  },

  async queue(batch: MessageBatch<any>, env: Env) {
    return queue(batch, env);
  },
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
      const registeredUserId = await registerNewUser(data, env, userCookie);
      return Response.json(data, {
        headers: {
          "Set-Cookie": `user_id=${registeredUserId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
        }
      });
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
      const registeredUserId = await registerNewUser(data, env, userCookie);
      return Response.json(data, {
        headers: {
          "Set-Cookie": `user_id=${registeredUserId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
        }
      });
    }
    return Response.json(data);
  }

  if (req.method === "POST" && url.pathname === "/auth/google/callback") {
    const formData = await req.formData();
    const idToken = formData.get("credential")?.toString();
    if (!idToken) return new Response("Missing credential", { status: 400 });

    try {
      const payloadBase64 = idToken.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      
      if (payload.aud !== env.GOOGLE_CLIENT_ID) {
          throw new Error("Invalid Google Client ID (audience mismatch)");
      }
      
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

  if (req.method === "POST" && url.pathname === "/auth/email/send") {
    const { email } = await req.json() as any;
    if (!email || !email.includes("@")) return Response.json({ error: "Invalid email" }, { status: 400 });
    
    const token = crypto.randomUUID();
    await env.STATS.put(`email_verify_${token}`, email, { expirationTtl: 900 });
    
    const magicLink = `${url.origin}/auth/email/verify?token=${token}`;
    const ok = await sendEmail(email, "Sign in to Whisper Messenger", `
      <h1>Whisper Messenger</h1>
      <p>Click the link below to sign in to your personal dashboard:</p>
      <a href="${magicLink}" style="padding:10px 20px;background:#8B5CF6;color:white;border-radius:8px;text-decoration:none;">Login Now</a>
      <p>If you didn't request this, you can ignore this email.</p>
      <br><small>Link expires in 15 minutes.</small>
    `, env);
    
    return Response.json({ success: ok });
  }

  if (req.method === "GET" && url.pathname === "/auth/email/verify") {
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 400 });
    
    const email = await env.STATS.get(`email_verify_${token}`);
    if (!email) return new Response("Invalid or expired link", { status: 400 });
    
    await env.STATS.delete(`email_verify_${token}`);
    const userId = `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
    
    const existingRaw = await env.STATS.get(`user_meta_${userId}`);
    if (!existingRaw) {
        const user: UserSession = {
            userId, firstName: email.split("@")[0],
            session: "", platform: "telegram", transcriptionCount: 0,
            isActive: false, createdAt: Date.now(), lastActiveAt: Date.now()
        };
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
        const listRaw = await env.STATS.get("users_list") || "[]";
        const list = JSON.parse(listRaw);
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
  }

  if (req.method === "GET" && url.pathname === "/auth/meta/login") {
      const redirectUri = encodeURIComponent(`${url.origin}/auth/meta/callback`);
      const fbUrl = `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&scope=pages_messaging,instagram_manage_messages,pages_show_list,instagram_basic,instagram_manage_comments`;
      return Response.redirect(fbUrl, 302);
  }

  if (req.method === "GET" && url.pathname === "/auth/meta/callback") {
      const code = url.searchParams.get("code");
      const userId = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
      if (!code || !userId) return new Response("Missing parameters", { status: 400 });

      // 1. Exchange code for user access token
      const redirectUri = `${url.origin}/auth/meta/callback`;
      const tokenRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&client_secret=${env.META_APP_SECRET}&code=${code}`);
      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok) return new Response(`FB Error: ${JSON.stringify(tokenData)}`, { status: 400 });

      const userToken = tokenData.access_token;
      
      // 2. Search for Pages connected to this user
      const pagesRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me/accounts?access_token=${userToken}`);
      const pagesData: any = await pagesRes.json();
      if (!pagesRes.ok || !pagesData.data) return new Response("Failed to fetch pages", { status: 400 });

      // Automatically pick first page for simplicity or show picker (simplicity first)
      const page = pagesData.data[0];
      if (!page) return new Response("No pages found", { status: 400 });

      const pageId = page.id;
      const pageToken = page.access_token;
      
      // 3. Optional: Check for Instagram ID
      const igRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
      const igData: any = await igRes.json();
      const instagramId = igData.instagram_business_account?.id;

      // 4. Subscribe the Page to Webhooks
      await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageToken}`, {
          method: "POST"
      });

      // 5. Save mapping and token
      await env.STATS.put(`meta_page_owner_${pageId}`, userId);
      if (instagramId) {
          await env.STATS.put(`meta_page_owner_${instagramId}`, userId);
      }
      
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (userData) {
          const user: UserSession = JSON.parse(userData);
          user.metaToken = pageToken;
          if (instagramId) user.instagramId = instagramId;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      }

      return Response.redirect(`${url.origin}/dashboard`, 302);
  }

  // Threads OAuth
  if (req.method === "GET" && url.pathname === "/auth/threads/login") {
      const redirectUri = encodeURIComponent(`${url.origin}/auth/threads/callback`);
      const threadsUrl = `https://www.threads.net/oauth/authorize?client_id=${env.META_THREADS_APP_ID}&redirect_uri=${redirectUri}&scope=threads_basic,threads_publish&response_type=code`;
      return Response.redirect(threadsUrl, 302);
  }

  if (req.method === "GET" && url.pathname === "/auth/threads/callback") {
      const code = url.searchParams.get("code");
      const userId = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
      if (!code || !userId) return new Response("Missing parameters", { status: 400 });

      // 1. Exchange code for short-lived token
      const redirectUri = `${url.origin}/auth/threads/callback`;
      const tokenRes = await fetch(`https://graph.threads.net/oauth/access_token?client_id=${env.META_THREADS_APP_ID}&client_secret=${env.META_THREADS_APP_SECRET}&grant_type=authorization_code&redirect_uri=${redirectUri}&code=${code}`);
      const tokenData: any = await tokenRes.json();
      if (!tokenRes.ok) return new Response(`Threads Error: ${JSON.stringify(tokenData)}`, { status: 400 });

      const threadsUserId = tokenData.user_id;
      const shortToken = tokenData.access_token;

      // 2. Exchange for long-lived token
      const longRes = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.META_THREADS_APP_SECRET}&access_token=${shortToken}`);
      const longData: any = await longRes.json();
      const longToken = longData.access_token;

      // 3. Save to KV
      await env.STATS.put(`threads_owner_${threadsUserId}`, userId);
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (userData) {
          const user: UserSession = JSON.parse(userData);
          user.threadsToken = longToken;
          user.threadsUserId = threadsUserId;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      }

      return Response.redirect(`${url.origin}/dashboard`, 302);
  }

  if (url.pathname === "/auth/logout") {
    return new Response("Redirect", { status: 302, headers: { "Location": "/", "Set-Cookie": `user_id=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
  }

  return new Response("Not found", { status: 404 });
}

async function registerNewUser(data: any, env: Env, existingUserId?: string): Promise<string> {
  const { userId: tgUserId, firstName, session } = data;
  const targetUserId = existingUserId || tgUserId;
  const existingRaw = await env.STATS.get(`user_meta_${targetUserId}`);
  let user: UserSession;

  if (existingRaw) {
    user = JSON.parse(existingRaw);
    user.session = session;
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

  const spawnRes = await fetch(`${env.BRIDGE_URL}/spawn`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
    body: JSON.stringify({ userId: targetUserId, session })
  });
  
  if (!spawnRes.ok) {
    const err = await spawnRes.text();
    await logError("bridge", `Failed to spawn pod for ${targetUserId}: ${err}`, env);
  }

  return targetUserId;
}

async function handleUserDashboard(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const userId = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];

  if (!userId) return new Response(null, { status: 302, headers: { "Location": "/" } });

  const userData = await env.STATS.get(`user_meta_${userId}`);
  if (!userData) return new Response(null, { status: 302, headers: { "Location": "/" } });
  const user: UserSession = JSON.parse(userData);

  if (req.method === "POST") {
    if (url.pathname === "/dashboard/save-meta") {
      const { metaToken } = await req.json() as any;
      if (metaToken) {
        // Fetch Page ID from Meta
        const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me?fields=id,name&access_token=${metaToken}`);
        if (res.ok) {
          const data: any = await res.json();
          const pageId = data.id;
          await env.STATS.put(`meta_page_owner_${pageId}`, userId);
          user.metaToken = metaToken;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
          return Response.json({ success: true, pageId, name: data.name });
        }
        return Response.json({ error: "Invalid token" }, { status: 400 });
      }
      user.metaToken = "";
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/save-wa") {
      const { whatsappToken, whatsappPhoneId } = await req.json() as any;
      user.whatsappToken = whatsappToken;
      user.whatsappPhoneId = whatsappPhoneId;
      if (whatsappPhoneId) {
        await env.STATS.put(`wa_phone_owner_${whatsappPhoneId}`, userId);
      }
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/test-tg") {
      try {
        const session = await env.STATS.get(`tg_session_${userId}`);
        const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId, session })
        });
        if (!res.ok) {
           const text = await res.text();
           return Response.json({ success: false, error: `Bridge error ${res.status}: ${text}` });
        }
        return Response.json({ success: true });
      } catch (e) {
        return Response.json({ success: false, error: (e as Error).message });
      }
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
  const global = await env.STATS.get("stats_telegram");
  await env.STATS.put("stats_telegram", String(parseInt(global || "0", 10) + 1));
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    const meta: UserSession = JSON.parse(metaRaw);
    meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
    meta.lastActiveAt = Date.now();
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
  }
}

async function sendEmail(to: string, subject: string, body: string, env: Env) {
  const mailReq = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: env.EMAIL_FROM || "no-reply@debug.org.ua", name: "Whisper Messenger" },
    subject: subject,
    content: [{ type: "text/html", value: body }]
  };
  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mailReq)
  });
  if (!res.ok) {
    console.error("MailChannels error:", await res.text());
    return false;
  }
  return true;
}

async function handleAdmin(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieAuth = req.headers.get("Cookie")?.match(/auth=([^;]+)/)?.[1];
  
  if (req.method === "POST" && url.pathname === "/admin/login") {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    if (password === env.ADMIN_SECRET) {
      return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `auth=${env.ADMIN_SECRET}; Path=/; HttpOnly; SameSite=Lax` } });
    }
  }
  
  if (url.pathname === "/admin/logout") {
    return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
  }
  
  if (cookieAuth !== env.ADMIN_SECRET) return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  // --- Admin Telegram Proxy Routes ---
  if (url.pathname === "/admin/ping-bridge") {
    try {
      const res = await fetch(`${env.BRIDGE_URL}/health`, { headers: { 'x-bridge-secret': env.BRIDGE_SECRET }});
      const text = await res.text();
      return new Response(`Bridge: ${res.status} ${text}`);
    } catch (e) {
      return new Response(`Worker Error: ${(e as Error).message}`, { status: 500 });
    }
  }

  if (url.pathname === "/admin/tg-status") {
    const userId = await env.STATS.get("admin_tg_userId");
    const session = await env.STATS.get("admin_tg_session");
    const hasPod = userId ? await fetch(`${env.BRIDGE_URL}/health`).then(r => r.ok).catch(() => false) : false;
    return Response.json({ authenticated: !!session, userId, bridgeAlive: hasPod });
  }

  if (url.pathname === "/admin/tg-send-code" && req.method === "POST") {
    const { phoneNumber } = await req.json() as any;
    return fetch(`${env.BRIDGE_URL}/send-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber })
    });
  }

  if (url.pathname === "/admin/tg-verify-code" && req.method === "POST") {
    const { phoneNumber, code } = await req.json() as any;
    const res = await fetch(`${env.BRIDGE_URL}/verify-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber, code })
    });
    const data: any = await res.json();
    if (data.success) {
      await env.STATS.put("admin_tg_userId", data.userId);
      await env.STATS.put("admin_tg_session", data.session);
    }
    return Response.json(data);
  }

  if (url.pathname === "/admin/tg-qr-login" && req.method === "POST") {
    return fetch(`${env.BRIDGE_URL}/qr-start`, {
      method: "POST", headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
  }

  if (url.pathname === "/admin/tg-qr-check") {
    const token = url.searchParams.get("token");
    const res = await fetch(`${env.BRIDGE_URL}/qr-check?token=${token}`, {
      headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
    const data: any = await res.json();
    if (data.done) {
      await env.STATS.put("admin_tg_userId", data.userId);
      await env.STATS.put("admin_tg_session", data.session);
    }
    return Response.json(data);
  }

  if (url.pathname === "/admin/tg-logout" && req.method === "POST") {
    await env.STATS.delete("admin_tg_userId");
    await env.STATS.delete("admin_tg_session");
    return Response.json({ success: true });
  }

  if (url.pathname === "/admin/tg-test-msg" && req.method === "POST") {
    const userId = await env.STATS.get("admin_tg_userId");
    const session = await env.STATS.get("admin_tg_session");
    if (!userId || !session) return Response.json({ error: "Not logged in" }, { status: 400 });
    try {
      const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId, session })
      });
      if (!res.ok) {
        const text = await res.text();
        return Response.json({ error: `Bridge returned ${res.status}: ${text}` }, { status: res.status });
      }
      return res;
    } catch (e) {
      return Response.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  const userIdsRaw = await env.STATS.get("users_list");
  const userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];
  const users: UserSession[] = [];
  for (const id of userIds) {
    const meta = await env.STATS.get(`user_meta_${id}`);
    if (meta) users.push(JSON.parse(meta));
  }

  const checks: HealthChecks = {
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

  if (url.pathname === "/admin/whisper-config") {
    if (req.method === "GET") {
      const provider = await env.STATS.get("config_whisper_provider") || env.WHISPER_PROVIDER || "cloudflare";
      const urlText = await env.STATS.get("config_local_whisper_url") || env.LOCAL_WHISPER_URL || "";
      const secretToken = await env.STATS.get("config_local_whisper_secret") || env.LOCAL_WHISPER_SECRET || "";
      return Response.json({ provider, url: urlText, secret: secretToken });
    }
    if (req.method === "POST") {
      const { provider, url: urlText, secret } = await req.json() as any;
      await env.STATS.put("config_whisper_provider", provider);
      await env.STATS.put("config_local_whisper_url", urlText);
      await env.STATS.put("config_local_whisper_secret", secret);
      return Response.json({ success: true });
    }
  }

  if (url.pathname === "/admin/user-action" && req.method === "POST") {
    const { userId, action } = await req.json() as any;
    if (action === "stop") {
      const res = await fetch(`${env.BRIDGE_URL}/delete`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId })
      });
      // Even if res fails with error, we might want to allow forcing the state to 'inactive' if user clicks again?
      // For now, only if res is ok
      if (res.ok) {
        const u = await env.STATS.get(`user_meta_${userId}`);
        if(u) {
          const meta = JSON.parse(u);
          meta.isActive = false;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
        }
      }
    } else if (action === "delete") {
       // Deep delete: remove from bridge, KV meta, and user list
       await fetch(`${env.BRIDGE_URL}/delete`, {
         method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
         body: JSON.stringify({ userId })
       }).catch(() => null); 

       await env.STATS.delete(`user_meta_${userId}`);
       await env.STATS.delete(`tg_session_${userId}`);
       const listRaw = await env.STATS.get("users_list") || "[]";
       const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
       await env.STATS.put("users_list", JSON.stringify(list));
    }
    return Response.json({ success: true });
  }

  return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  const msg = update.message;
  if (!msg) return new Response("ok");
  const voice = msg.voice || msg.audio;
  if (voice) {
    await sendTelegramTypingOn(msg.chat.id, env);
    await sendTelegramMessage(msg.chat.id, "⏳ Transcribing...", env);
    const audioUrl = await getTelegramFileUrl(voice.file_id, env);
    if (audioUrl) await env.AUDIO_QUEUE.send({ senderId: String(msg.chat.id), audioUrl, platform: "telegram" });
  }
  return new Response("ok");
}

async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
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

async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
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
