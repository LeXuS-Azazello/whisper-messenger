import { Env, UserSession } from "../types";
import { renderAuthPage } from "../auth_ui";
import { logError } from "../logger";
import { createSignedSession } from "../session";

interface SendCodeRequest { phone: string; }
interface VerifyCodeRequest { phone: string; code: string; }
interface VerifyPasswordRequest { phone?: string; token?: string; password: string; }
interface EmailSendRequest { email: string; }
interface BridgeUserData { userId: string; firstName: string; session: string; phone?: string; success?: boolean; error?: string; done?: boolean; }

const SESSION_MAX_AGE = 31536000;
const EMAIL_VERIFY_TTL = 900;
const RATE_LIMIT_TTL = 60;

function handleAuthPage(currentUserId: string | null): Response {
  const isAuthenticated = !!currentUserId;
  if (isAuthenticated) return new Response("Redirecting...", { status: 302, headers: { "Location": "/dashboard" } });
  return new Response(renderAuthPage(undefined, isAuthenticated), { 
    headers: { 
      "Content-Type": "text/html; charset=utf-8",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
    } 
  });
}

async function handleQrStart(env: Env): Promise<Response> {
  return fetch(`${env.BRIDGE_URL}/qr-start`, {
    method: "POST", headers: { "x-bridge-secret": env.BRIDGE_SECRET || "" }
  });
}

async function handleSendCode(env: Env, body: SendCodeRequest): Promise<Response> {
  const { phone } = body;
  if (!phone || typeof phone !== 'string' || phone.length < 7) {
    return Response.json({ error: "Invalid phone number" }, { status: 400 });
  }
  return fetch(`${env.BRIDGE_URL}/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "" },
    body: JSON.stringify({ phone })
  });
}

async function handleVerifyCode(env: Env, body: VerifyCodeRequest, userCookie: string | null | undefined, currentUserId: string | null | undefined): Promise<Response> {
  const { phone, code } = body;
  if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string' || phone.length < 7 || code.length < 4) {
    return Response.json({ error: "Invalid phone or code" }, { status: 400 });
  }
  const res = await fetch(`${env.BRIDGE_URL}/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "" },
    body: JSON.stringify({ phone, code })
  });
  const data: BridgeUserData & { requiresPassword?: boolean } = await res.json();
  if (data.success) {
    const registeredUserId = await registerNewUser(data, env, currentUserId || userCookie || undefined);
    await logError("auth", `User ${registeredUserId} authenticated via phone`, env);
    return await createSessionResponse(registeredUserId, env);
  }
  
  if (data.requiresPassword) {
    return Response.json({ requiresPassword: true });
  }

  if (data.error) {
    await logError("auth", `Verify failed for ${phone}: ${data.error}`, env);
  }
  return Response.json(data);
}

async function handleVerifyPassword(env: Env, body: VerifyPasswordRequest, userCookie: string | null | undefined, currentUserId: string | null | undefined): Promise<Response> {
  const { phone, token, password } = body;
  if (!password || (!phone && !token)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  
  const res = await fetch(`${env.BRIDGE_URL}/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "" },
    body: JSON.stringify({ phone, token, password })
  });
  const data: BridgeUserData = await res.json();
  if (data.success) {
    const registeredUserId = await registerNewUser(data, env, currentUserId || userCookie || undefined);
    await logError("auth", `User ${registeredUserId} authenticated via 2FA`, env);
    return await createSessionResponse(registeredUserId, env);
  }
  return Response.json(data, { status: res.status });
}

async function handleQrCheck(env: Env, token: string | null | undefined, userCookie: string | null | undefined, currentUserId: string | null | undefined): Promise<Response> {
  if (!token || typeof token !== 'string') {
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }
  const res = await fetch(`${env.BRIDGE_URL}/qr-check?token=${token}`, {
    headers: { "x-bridge-secret": env.BRIDGE_SECRET || "" }
  });
  const data: BridgeUserData & { requiresPassword?: boolean } = await res.json();
  if (data.done) {
    const registeredUserId = await registerNewUser(data, env, currentUserId || userCookie || undefined);
    await logError("auth", `User ${registeredUserId} authenticated via QR`, env);
    return await createSessionResponse(registeredUserId, env);
  }
  if (data.requiresPassword) {
    return Response.json({ requiresPassword: true });
  }
  return Response.json(data);
}

async function handleGoogleCallback(env: Env, formData: FormData, url: URL, currentUserId: string | null | undefined): Promise<Response> {
    // If already logged in, redirect to dashboard
    if (currentUserId) {
      return Response.redirect(`${url.origin}/dashboard`, 302);
    }

    const credential = formData.get('credential') as string;
    if (!credential) return new Response("Missing credential", { status: 400 });

    try {
      // Use Google's tokeninfo endpoint for verification (more compatible with Cloudflare Workers)
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
      if (!tokenInfoRes.ok) {
        return new Response("Auth Error: Invalid Google credential", { status: 400 });
      }

      const tokenInfo = await tokenInfoRes.json() as { aud: string; sub: string; email: string; given_name?: string; name?: string };

      // Verify audience
      if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
        return new Response("Auth Error: Invalid Google Client ID (audience mismatch)", { status: 500 });
      }

      const sub = tokenInfo.sub;
      const email = tokenInfo.email;
      const givenName = tokenInfo.given_name || tokenInfo.name || email.split('@')[0];
      const name = tokenInfo.name || givenName;

      const userId = `google_${sub}`;

      // Check if user exists
      const existingRaw = await env.STATS.get(`user_meta_${userId}`);
      if (!existingRaw) {
        const user: UserSession = {
          userId,
          firstName: givenName,
          username: name,
          session: "",
          platform: "telegram", // Keep as telegram for compatibility
          transcriptionCount: 0,
          isActive: true,
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          email
        };
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

        // Add to users_list
        const listRaw = await env.STATS.get("users_list") || "[]";
        const list = JSON.parse(listRaw);
        if (!list.includes(userId)) {
          list.push(userId);
          await env.STATS.put("users_list", JSON.stringify(list));
        }
      }

      await logError("auth", `User ${userId} authenticated via Google`, env);
      return await createSessionResponse(userId, env);

    } catch (error) {
      await logError("auth", `Google auth error: ${error}`, env);
      return new Response("Auth Error: Invalid Google credential", { status: 400 });
    }
  }

async function handleEmailSend(env: Env, body: EmailSendRequest, url: URL): Promise<Response> {
  const { email } = body;
  if (!email || !email.includes("@")) return Response.json({ error: "Invalid email" }, { status: 400 });

  const rateKey = `rate_email_${email}`;
  const rateLimit = await env.STATS.get(rateKey);
  if (rateLimit) return Response.json({ error: "Too many requests, try again later" }, { status: 429 });

  const token = crypto.randomUUID();
  await env.STATS.put(`email_verify_${token}`, email, { expirationTtl: EMAIL_VERIFY_TTL });
  await env.STATS.put(rateKey, "1", { expirationTtl: RATE_LIMIT_TTL });

  return Response.json({ success: true });
}

async function handleEmailVerify(env: Env, token: string | null, url: URL): Promise<Response> {
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

  return new Response("ok", { status: 200 });
}

async function handleMetaLogin(env: Env, url: URL): Promise<Response> {
  const redirectUri = encodeURIComponent(`${url.origin}/auth/meta/callback`);
  const fbUrl = `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&scope=pages_messaging,instagram_manage_messages,pages_show_list,instagram_basic,instagram_manage_comments`;
  return Response.redirect(fbUrl, 302);
}

async function handleMetaCallback(env: Env, code: string, userId: string, url: URL): Promise<Response> {
  const redirectUri = `${url.origin}/auth/meta/callback`;
  const tokenRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/oauth/access_token?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&client_secret=${env.META_APP_SECRET}&code=${code}`);
  const tokenData: any = await tokenRes.json();
  if (!tokenRes.ok) return new Response(`FB Error: ${JSON.stringify(tokenData)}`, { status: 400 });

  const userToken = tokenData.access_token;

  const pagesRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me/accounts?access_token=${userToken}`);
  const pagesData: any = await pagesRes.json();
  if (!pagesRes.ok || !pagesData.data) return new Response("Failed to fetch pages", { status: 400 });

  const page = pagesData.data[0];
  if (!page) return new Response("No pages found", { status: 400 });

  const pageId = page.id;
  const pageToken = page.access_token;

  const igRes = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
  const igData: any = await igRes.json();
  const instagramId = igData.instagram_business_account?.id;

  await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/${pageId}/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=${pageToken}`, {
    method: "POST"
  });

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

async function handleThreadsLogin(env: Env, url: URL): Promise<Response> {
  const redirectUri = encodeURIComponent(`${url.origin}/auth/threads/callback`);
  const threadsUrl = `https://www.threads.net/oauth/authorize?client_id=${env.META_THREADS_APP_ID}&redirect_uri=${redirectUri}&scope=threads_basic,threads_publish&response_type=code`;
  return Response.redirect(threadsUrl, 302);
}

async function handleThreadsCallback(env: Env, code: string, userId: string, url: URL): Promise<Response> {
  const redirectUri = `${url.origin}/auth/threads/callback`;
  const tokenRes = await fetch(`https://graph.threads.net/oauth/access_token?client_id=${env.META_THREADS_APP_ID}&client_secret=${env.META_THREADS_APP_SECRET}&grant_type=authorization_code&redirect_uri=${redirectUri}&code=${code}`);
  const tokenData: any = await tokenRes.json();
  if (!tokenRes.ok) return new Response(`Threads Error: ${JSON.stringify(tokenData)}`, { status: 400 });

  const threadsUserId = tokenData.user_id;
  const shortToken = tokenData.access_token;

  const longRes = await fetch(`https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.META_THREADS_APP_SECRET}&access_token=${shortToken}`);
  const longData: any = await longRes.json();
  const longToken = longData.access_token;

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

function handleLogout(): Response {
  return new Response("Redirect", { status: 302, headers: { "Location": "/", "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT" } });
}

async function createSessionResponse(userId: string, env: Env): Promise<Response> {
  const signedSession = await createSignedSession(userId, env.SESSION_SECRET || "default_session_secret");
  return new Response("Redirecting...", {
    status: 302,
    headers: {
      "Location": "/dashboard",
      "Set-Cookie": `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
    }
  });
}

export async function handlePublicAuth(env: Env, req: Request, currentUserId: string | null): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  if (method === "GET" && pathname === "/auth") {
    return handleAuthPage(currentUserId);
  }

  if (method === "POST" && pathname === "/auth/qr-start") {
    return await handleQrStart(env);
  }

  if (method === "POST" && pathname === "/auth/send-code") {
    try {
      const body = await req.json() as SendCodeRequest;
      return await handleSendCode(env, body);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (method === "POST" && pathname === "/auth/verify-code") {
    try {
      const body = await req.json() as VerifyCodeRequest;
      const userCookie = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1] || null;
      return await handleVerifyCode(env, body, userCookie, currentUserId || null);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (method === "POST" && pathname === "/auth/verify-password") {
    try {
      const body = await req.json() as VerifyPasswordRequest;
      const userCookie = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1] || null;
      return await handleVerifyPassword(env, body, userCookie, currentUserId || null);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (method === "GET" && pathname === "/auth/qr-check") {
    const token = url.searchParams.get("token") || null;
    const userCookie = req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1] || null;
    return await handleQrCheck(env, token, userCookie, currentUserId || null);
  }

  if (method === "POST" && pathname === "/auth/google/callback") {
    const formData = await req.formData();
    return await handleGoogleCallback(env, formData, url, currentUserId);
  }

  if (method === "POST" && pathname === "/auth/email/send") {
    try {
      const body = await req.json() as EmailSendRequest;
      return await handleEmailSend(env, body, url);
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  if (method === "GET" && pathname === "/auth/email/verify") {
    const token = url.searchParams.get("token");
    return await handleEmailVerify(env, token, url);
  }

  if (method === "GET" && pathname === "/auth/meta/login") {
    return await handleMetaLogin(env, url);
  }

  if (method === "GET" && pathname === "/auth/meta/callback") {
    const code = url.searchParams.get("code");
    const userId = currentUserId || req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
    if (!code || !userId) return new Response("Missing parameters", { status: 400 });
    return await handleMetaCallback(env, code, userId, url);
  }

  if (method === "GET" && pathname === "/auth/threads/login") {
    return await handleThreadsLogin(env, url);
  }

  if (method === "GET" && pathname === "/auth/threads/callback") {
    const code = url.searchParams.get("code");
    const userId = currentUserId || req.headers.get("Cookie")?.match(/user_id=([^;]+)/)?.[1];
    if (!code || !userId) return new Response("Missing parameters", { status: 400 });
    return await handleThreadsCallback(env, code, userId, url);
  }

  if (pathname === "/auth/logout") {
    return handleLogout();
  }

  return new Response("Not found", { status: 404 });
}

async function registerNewUser(data: BridgeUserData, env: Env, existingUserId?: string | null): Promise<string> {
  const { userId: tgUserId, firstName, session, phone } = data;
  const targetUserId = existingUserId || tgUserId;
  const existingRaw = await env.STATS.get(`user_meta_${targetUserId}`);
  let user: any;

  if (existingRaw) {
    user = JSON.parse(existingRaw);
    user.session = session;
    if (phone && !user.phone) user.phone = phone;
    user.lastActiveAt = Date.now();
    user.isActive = true;
  } else {
    user = {
      userId: targetUserId, firstName, phone, session,
      platform: "telegram", createdAt: Date.now(), lastActiveAt: Date.now(),
      lastStartedAt: Date.now(), isActive: true, transcriptionCount: 0
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