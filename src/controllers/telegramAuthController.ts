import { Env, UserSession } from "../types";
import { getPublicOrigin, createSessionResponse } from "./authController";

interface BridgeUserData { userId: string; firstName: string; session: string; phone?: string; success?: boolean; error?: string; done?: boolean; }
const SESSION_MAX_AGE = 31536000;

function getBridgeUrl(env: Env): string {
  return (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
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
    body: JSON.stringify({ phone, code })
  });

  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.success && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      } else {
        const newUser: UserSession = {
          userId, firstName: data.firstName || "Telegram User",
          session: data.session, platform: "telegram", transcriptionCount: 0,
          isActive: true, createdAt: Date.now(), lastActiveAt: Date.now()
        };
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(newUser));
        const listRaw = await env.STATS.get("users_list") || "[]";
        const list = JSON.parse(listRaw);
        if (!list.includes(userId)) {
          list.push(userId);
          await env.STATS.put("users_list", JSON.stringify(list));
        }
      }
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
    body: JSON.stringify(bodyData)
  });

  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.success && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      } else {
        const newUser: UserSession = {
          userId, firstName: data.firstName || "Telegram User",
          session: data.session, platform: "telegram", transcriptionCount: 0,
          isActive: true, createdAt: Date.now(), lastActiveAt: Date.now()
        };
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(newUser));
      }
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
  
  const bridgeRes = await fetch(`${bridgeUrl}/qr-check?token=${token}&secret=${secret}`, {
    headers: { "x-bridge-secret": secret }
  });

  if (bridgeRes.ok) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.done && data.session) {
      const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;
      
      const userData = await env.STATS.get(`user_meta_${userId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        user.firstName = data.firstName || user.firstName;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      } else {
        const newUser: UserSession = {
          userId,
          firstName: data.firstName || "Telegram User",
          session: data.session,
          platform: "telegram",
          transcriptionCount: 0,
          isActive: true,
          createdAt: Date.now(),
          lastActiveAt: Date.now()
        };
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(newUser));
      }

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
