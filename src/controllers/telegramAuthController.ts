import { Env, UserSession } from "../types";
import { getPublicOrigin, createSessionResponse } from "./authController";
import User from "../models/User";
import MessengerSession from "../models/MessengerSession";

interface ManagerUserData { userId: string; firstName: string; session: string; username?: string; phone?: string; success?: boolean; error?: string; done?: boolean; }

const SESSION_MAX_AGE = 31536000;

function getManagerUrl(env: Env): string {
  return (env.MANAGER_URL || "http://tg-client-manager.debugging-testcrash-pub.svc.cluster.local:3000").replace(/\/$/, '');
}

export async function handleTelegramSendCode(env: Env, req: Request): Promise<Response> {
  const { phone } = await req.json() as any;
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  console.log(`[Auth] Proxied /send-code to ${managerUrl}/send-code`);
  const managerRes = await fetch(`${managerUrl}/send-code?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": secret
    },
    body: JSON.stringify({ phone })
  });

  if (!managerRes.ok) {
    console.error(`[Auth] Manager /send-code failed: ${managerRes.status} ${managerRes.statusText}`);
  }
  const body = await managerRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: managerRes.status, statusText: managerRes.statusText, headers });
}

export async function handleTelegramVerifyCode(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const { phone, code } = await req.json() as any;
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  const managerRes = await fetch(`${managerUrl}/verify-code?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": secret
    },
    body: JSON.stringify({ phone, code, userId: currentUserId })
  });


  if (managerRes.ok) {
    const data = await managerRes.clone().json() as ManagerUserData;
    if (data.success && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;

      // Update or create User
      await User.findOneAndUpdate(
        { userId },
        {
          userId,
          firstName: data.firstName || "Telegram User"
        },
        { upsert: true }
      );

      // Update or create MessengerSession
      await MessengerSession.findOneAndUpdate(
        { userId, platform: "telegram", identifier: data.phone || userId },
        {
          userId,
          platform: "telegram",
          identifier: data.phone || userId,
          sessionData: data.session,
          isActive: true
        },
        { upsert: true }
      );

      // Update user_meta in STATS so dashboard reflects connection
      const metaRaw = await env.STATS.get(`user_meta_${userId}`);
      let metaUser: UserSession = metaRaw ? JSON.parse(metaRaw) : { userId };
      metaUser.session = data.session;
      metaUser.isActive = true;
      metaUser.firstName = data.firstName || metaUser.firstName || "Telegram User";
      metaUser.username = data.username || metaUser.username;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(metaUser));


      // Still keep in Redis for legacy/cache if needed, but primary is MongoDB now
      await env.STATS.put(`tg_session_${userId}`, data.session, { expirationTtl: SESSION_MAX_AGE });
      ctx.waitUntil(fetch(`${managerUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      if (!currentUserId) return await createSessionResponse(userId, env, true);
    }
  }

  const body = await managerRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: managerRes.status, statusText: managerRes.statusText, headers });
}

export async function handleTelegramVerifyPassword(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const bodyData = await req.json() as any;
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  const managerRes = await fetch(`${managerUrl}/verify-password?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-manager-secret": secret
    },
    body: JSON.stringify({ ...bodyData, userId: currentUserId })
  });


  if (managerRes.ok) {
    const data = await managerRes.clone().json() as ManagerUserData;
    if (data.success && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;

      // Update or create User
      await User.findOneAndUpdate(
        { userId },
        {
          userId,
          firstName: data.firstName || "Telegram User"
        },
        { upsert: true }
      );

      // Update or create MessengerSession
      await MessengerSession.findOneAndUpdate(
        { userId, platform: "telegram", identifier: userId },
        {
          userId,
          platform: "telegram",
          identifier: userId,
          sessionData: data.session,
          isActive: true
        },
        { upsert: true }
      );

      // Update user_meta in STATS so dashboard reflects connection
      const metaRaw = await env.STATS.get(`user_meta_${userId}`);
      let metaUser: UserSession = metaRaw ? JSON.parse(metaRaw) : { userId };
      metaUser.session = data.session;
      metaUser.isActive = true;
      metaUser.firstName = data.firstName || metaUser.firstName || "Telegram User";
      metaUser.username = data.username || metaUser.username;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(metaUser));


      await env.STATS.put(`tg_session_${userId}`, data.session, { expirationTtl: SESSION_MAX_AGE });
      ctx.waitUntil(fetch(`${managerUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      if (!currentUserId) return await createSessionResponse(userId, env, true);
    }
  }

  const respBody = await managerRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(respBody, { status: managerRes.status, statusText: managerRes.statusText, headers });
}

export async function handleTelegramQrStart(env: Env): Promise<Response> {
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  console.log(`[Auth] Proxied /qr-start to ${managerUrl}/qr-start`);
  const managerRes = await fetch(`${managerUrl}/qr-start?secret=${secret}`, {
    method: "POST",
    headers: { "x-manager-secret": secret }
  });

  if (!managerRes.ok) {
    console.error(`[Auth] Manager /qr-start failed: ${managerRes.status} ${managerRes.statusText}`);
  }
  const body = await managerRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: managerRes.status, statusText: managerRes.statusText, headers });
}

export async function handleTelegramQrCheck(env: Env, token: string | null, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const secret = (env.MANAGER_SECRET || "changeme").trim();
  const managerUrl = getManagerUrl(env);

  const managerRes = await fetch(`${managerUrl}/qr-check?token=${token}&secret=${secret}${currentUserId ? `&userId=${currentUserId}` : ''}`, {
    headers: { "x-manager-secret": secret }
  });


  if (managerRes.ok) {
    const data = await managerRes.clone().json() as ManagerUserData;
    if (data.done && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;

      // Update or create User
      await User.findOneAndUpdate(
        { userId },
        {
          userId,
          firstName: data.firstName || "Telegram User"
        },
        { upsert: true }
      );

      // Update or create MessengerSession
      await MessengerSession.findOneAndUpdate(
        { userId, platform: "telegram", identifier: userId },
        {
          userId,
          platform: "telegram",
          identifier: userId,
          sessionData: data.session,
          isActive: true
        },
        { upsert: true }
      );

      // Update user_meta in STATS so dashboard reflects connection
      const metaRaw = await env.STATS.get(`user_meta_${userId}`);
      let metaUser: UserSession = metaRaw ? JSON.parse(metaRaw) : { userId };
      metaUser.session = data.session;
      metaUser.isActive = true;
      metaUser.firstName = data.firstName || metaUser.firstName || "Telegram User";
      metaUser.username = data.username || metaUser.username;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(metaUser));


      await env.STATS.put(`tg_session_${userId}`, data.session, { expirationTtl: SESSION_MAX_AGE });

      ctx.waitUntil(fetch(`${managerUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));

      if (!currentUserId) {
        return await createSessionResponse(userId, env, true);
      }
    }
  }

  const respBody = await managerRes.clone().arrayBuffer();
  const respHeaders: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { respHeaders[key] = value; });
  return new Response(respBody, { status: managerRes.status, statusText: managerRes.statusText, headers: respHeaders });
}
export async function handleTelegramVerifyEmail(env: Env, req: Request): Promise<Response> {
  const { phone, email } = await req.json() as any;
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  return await fetch(`${managerUrl}/verify-email?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manager-secret": secret },
    body: JSON.stringify({ phone, email })
  });
}

export async function handleTelegramBotLogin(env: Env, req: Request, currentUserId: string | null, ctx: any): Promise<Response> {
  const { token } = await req.json() as any;
  const managerUrl = getManagerUrl(env);
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  const managerRes = await fetch(`${managerUrl}/bot-login?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manager-secret": secret },
    body: JSON.stringify({ token, userId: currentUserId })
  });

  if (managerRes.ok) {
    const data = await managerRes.clone().json() as ManagerUserData;
    if (data.success && data.session) {
      const userId = currentUserId || data.userId || `bot_${data.session.substring(0, 8)}`;
      await User.findOneAndUpdate({ userId }, { userId, firstName: data.firstName || "Telegram Bot" }, { upsert: true });
      await MessengerSession.findOneAndUpdate({ userId, platform: "telegram", identifier: userId }, { userId, platform: "telegram", identifier: userId, sessionData: data.session, isActive: true }, { upsert: true });
      await env.STATS.put(`tg_session_${userId}`, data.session, { expirationTtl: SESSION_MAX_AGE });
      
      ctx.waitUntil(fetch(`${managerUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-manager-secret': secret },
        body: JSON.stringify({ userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Bot spawn error:", e)));

      if (!currentUserId) return await createSessionResponse(userId, env, true);
    }
  }

  const body = await managerRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  managerRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: managerRes.status, statusText: managerRes.statusText, headers });
}
