import { Env, UserSession } from "../types";
import { getPublicOrigin } from "./authController";

interface BridgeUserData { userId: string; firstName: string; session: string; phone?: string; success?: boolean; error?: string; done?: boolean; }
const SESSION_MAX_AGE = 31536000;

function getBridgeUrl(env: Env): string {
  return (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
}

export async function handleTelegramSendCode(env: Env, req: Request): Promise<Response> {
  const { phone } = await req.json() as any;
  const bridgeUrl = getBridgeUrl(env);
  const secret = (env.BRIDGE_SECRET || "changeme").trim();
  
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

  if (bridgeRes.ok && currentUserId) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.success && data.session) {
      const userData = await env.STATS.get(`user_meta_${currentUserId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        await env.STATS.put(`user_meta_${currentUserId}`, JSON.stringify(user));
        await env.STATS.put(`tg_session_${currentUserId}`, data.session, { expirationTtl: SESSION_MAX_AGE });

        ctx.waitUntil(fetch(`${getPublicOrigin(env, url.origin)}/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
          body: JSON.stringify({ userId: currentUserId, session: data.session })
        }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      }
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

  if (bridgeRes.ok && currentUserId) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.success && data.session) {
      const userData = await env.STATS.get(`user_meta_${currentUserId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        await env.STATS.put(`user_meta_${currentUserId}`, JSON.stringify(user));
        await env.STATS.put(`tg_session_${currentUserId}`, data.session, { expirationTtl: SESSION_MAX_AGE });

        ctx.waitUntil(fetch(`${getPublicOrigin(env, url.origin)}/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
          body: JSON.stringify({ userId: currentUserId, session: data.session })
        }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      }
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

  if (bridgeRes.ok && currentUserId) {
    const data = await bridgeRes.clone().json() as BridgeUserData;
    if (data.done && data.session) {
      const userData = await env.STATS.get(`user_meta_${currentUserId}`);
      if (userData) {
        const user: UserSession = JSON.parse(userData);
        user.session = data.session;
        user.isActive = true;
        user.firstName = data.firstName || user.firstName;
        await env.STATS.put(`user_meta_${currentUserId}`, JSON.stringify(user));
        await env.STATS.put(`tg_session_${currentUserId}`, data.session, { expirationTtl: SESSION_MAX_AGE });

        ctx.waitUntil(fetch(`${getPublicOrigin(env, url.origin)}/spawn`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-bridge-secret': (env.BRIDGE_SECRET || 'changeme').trim() },
          body: JSON.stringify({ userId: currentUserId, session: data.session })
        }).catch((e: any) => console.error("[Auth] Spawn error:", e)));
      }
    }
  }

  const respBody = await bridgeRes.clone().arrayBuffer();
  const respHeaders: Record<string, string> = {};
  bridgeRes.headers.forEach((value, key) => { respHeaders[key] = value; });
  return new Response(respBody, { status: bridgeRes.status, statusText: bridgeRes.statusText, headers: respHeaders });
}
