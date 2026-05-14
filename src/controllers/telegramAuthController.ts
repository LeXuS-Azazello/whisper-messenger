import { Env, UserSession } from "../types";
import { getPublicOrigin, createSessionResponse } from "./authController";
import User from "../models/User";
import MessengerSession from "../models/MessengerSession";

interface BridgeUserData { userId: string; firstName: string; session: string; username?: string; phone?: string; success?: boolean; error?: string; done?: boolean; }

const SESSION_MAX_AGE = 31536000;

function getBridgeUrl(env: Env): string {
  return (env.BRIDGE_URL || "http://mtproto-bridge-manager.debugging-testcrash-pub.svc.cluster.local:3000").replace(/\/$/, '');
}

export async function handleTelegramSendCode(env: Env, req: Request): Promise<Response> {
  const { phone } = await req.json() as any;
  const bridgeUrl = getBridgeUrl(env);
  const secret = (env.BRIDGE_SECRET || "changeme").trim();

  console.log(`[Auth] Proxied /send-code to ${bridgeUrl}/send-code`);
  const bridgeRes = await fetch(`${bridgeUrl}/send-code?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret
    },
    body: JSON.stringify({ phone })
  });

  if (!bridgeRes.ok) {
    console.error(`[Auth] Bridge /send-code failed: ${bridgeRes.status} ${bridgeRes.statusText}`);
  }
  const body = await bridgeRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers });
}

export async function handleTelegramVerifyCode(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const { phone, code } = await req.json() as any;
  const bridgeUrl = getBridgeUrl(env);
  const secret = (env.BRIDGE_SECRET || "changeme").trim();

  const bridgeRes = await fetch(`${bridgeUrl}/verify-code?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret
    },
    body: JSON.stringify({ phone, code, userId: currentUserId })
  });


  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
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
      ctx.waitUntil(fetch(`${bridgeUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      if (!currentUserId) return await createSessionResponse(userId, env, true);
    }
  }

  const body = await bridgeRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers });
}

export async function handleTelegramVerifyPassword(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const bodyData = await req.json() as any;
  const bridgeUrl = getBridgeUrl(env);
  const secret = (env.BRIDGE_SECRET || "changeme").trim();

  const bridgeRes = await fetch(`${bridgeUrl}/verify-password?secret=${secret}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": secret
    },
    body: JSON.stringify({ ...bodyData, userId: currentUserId })
  });


  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
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
      ctx.waitUntil(fetch(`${bridgeUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      if (!currentUserId) return await createSessionResponse(userId, env, true);
    }
  }

  const respBody = await bridgeRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(respBody, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers });
}

export async function handleTelegramQrStart(env: Env): Promise<Response> {
  const bridgeUrl = getBridgeUrl(env);
  const secret = (env.BRIDGE_SECRET || "changeme").trim();

  console.log(`[Auth] Proxied /qr-start to ${bridgeUrl}/qr-start`);
  const bridgeRes = await fetch(`${bridgeUrl}/qr-start?secret=${secret}`, {
    method: "POST",
    headers: { "x-bridge-secret": secret }
  });

  if (!bridgeRes.ok) {
    console.error(`[Auth] Bridge /qr-start failed: ${bridgeRes.status} ${bridgeRes.statusText}`);
  }
  const body = await bridgeRes.clone().arrayBuffer();
  const headers: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { headers[key] = value; });
  return new Response(body, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers });
}

export async function handleTelegramQrCheck(env: Env, token: string | null, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const secret = (env.BRIDGE_SECRET || "changeme").trim();
  const bridgeUrl = getBridgeUrl(env);

  const bridgeRes = await fetch(`${bridgeUrl}/qr-check?token=${token}&secret=${secret}${currentUserId ? `&userId=${currentUserId}` : ''}`, {
    headers: { "x-bridge-secret": secret }
  });


  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
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

      ctx.waitUntil(fetch(`${bridgeUrl}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
        body: JSON.stringify({ userId: userId, session: data.session })
      }).catch((e: any) => console.error("[Auth] Spawn error:", e)));

      if (!currentUserId) {
        return await createSessionResponse(userId, env, true);
      }
    }
  }

  const respBody = await bridgeRes.clone().arrayBuffer();
  const respHeaders: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { respHeaders[key] = value; });
  return new Response(respBody, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers: respHeaders });
}
