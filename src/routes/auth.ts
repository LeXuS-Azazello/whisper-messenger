import { Env, UserSession } from "../types";
import { renderAuthPage } from "../auth_ui";
import { logError } from "../logger";
import { createSignedSession } from "../session";

export async function handlePublicAuth(env: Env, req: Request, currentUserId: string | null): Promise<Response> {
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
      const registeredUserId = await registerNewUser(data, env, currentUserId || userCookie);
      const signedSession = await createSignedSession(registeredUserId, env.SESSION_SECRET || env.ADMIN_SECRET);
      return Response.json(data, {
        headers: {
          "Set-Cookie": `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
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
      const registeredUserId = await registerNewUser(data, env, currentUserId || userCookie);
      const signedSession = await createSignedSession(registeredUserId, env.SESSION_SECRET || env.ADMIN_SECRET);
      return Response.json(data, {
        headers: {
          "Set-Cookie": `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
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
      // TODO: IMPLEMENT CRYPTOGRAPHIC VERIFICATION OF payload signature
      // For now, checking the audience is a minimal check, but we need full JWT verify.
      
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
      
      const signedSession = await createSignedSession(userId, env.SESSION_SECRET || env.ADMIN_SECRET || "fallback_secret");
      return new Response("Redirecting...", {
        status: 302, headers: { 
            "Location": "/dashboard",
            "Set-Cookie": `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` 
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

    const signedSession = await createSignedSession(userId, env.SESSION_SECRET || env.ADMIN_SECRET || "fallback_secret");
    return new Response("Redirecting...", {
      status: 302, headers: { 
          "Location": "/dashboard",
          "Set-Cookie": `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` 
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
      const userId = currentUserId || req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
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
      const userId = currentUserId || req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
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
    return new Response("Redirect", { status: 302, headers: { "Location": "/", "Set-Cookie": `session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
  }

  return new Response("Not found", { status: 404 });
}

export async function registerNewUser(data: any, env: Env, existingUserId?: string): Promise<string> {
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

export async function sendEmail(to: string, subject: string, body: string, env: Env) {
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
