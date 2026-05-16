import { Env, UserSession } from "../types";
import { getPublicOrigin, createSessionResponse } from "./authController";
import User from "../models/User";
import MessengerSession from "../models/MessengerSession";
import { authSessions, createTdClient, packSession } from "../tdlibManager";
import QRCode from 'qrcode';

const SESSION_MAX_AGE = 31536000;
const finishedSessions = new Map<string, any>();

async function saveAuthSessionData(env: Env, data: any, currentUserId: string | null) {
  const userId = currentUserId || data.userId || `tg_${data.session.substring(0, 8)}`;

  await User.findOneAndUpdate(
    { userId },
    {
      userId,
      firstName: data.firstName || "Telegram User"
    },
    { upsert: true }
  );

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

  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  let metaUser: UserSession = metaRaw ? JSON.parse(metaRaw) : { userId };
  metaUser.session = data.session;
  metaUser.isActive = true;
  metaUser.firstName = data.firstName || metaUser.firstName || "Telegram User";
  metaUser.username = data.username || metaUser.username;
  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(metaUser));

  await env.STATS.put(`tg_session_${userId}`, data.session, { expirationTtl: SESSION_MAX_AGE });
  return userId;
}

export async function handleTelegramSendCode(env: Env, req: Request): Promise<Response> {
  const { phone } = await req.json() as any;
  if (!phone) return Response.json({ error: "Missing phone" }, { status: 400 });

  const phoneClean = String(phone).trim();
  const existing = authSessions.get(phoneClean);
  if (existing) {
    if (existing.status === 'connecting' && (Date.now() - (existing.createdAt || 0) < 10000)) {
      return Response.json({ success: true, message: 'Code already being sent' });
    }
    if (existing.client) {
      try { await existing.client.close(); } catch (e) { }
    }
    authSessions.delete(phoneClean);
  }

  const client = createTdClient(phoneClean);
  const session: any = { client, phone: phoneClean, status: 'connecting', createdAt: Date.now(), responded: false };
  authSessions.set(phoneClean, session);

  let responseData: any = null;
  let responseStatus = 200;
  
  const promise = new Promise<void>((resolve) => {
    client.on('error', (err: any) => {
      console.error(`[/send-code] TDLib client error for ${phoneClean}:`, err);
      if (!session.responded) {
        session.responded = true;
        responseData = { error: `TDLib error: ${err.message}` };
        responseStatus = 500;
        resolve();
      }
    });

    client.on('update', async (update: any) => {
      if (update['_'] !== 'updateAuthorizationState') return;
      const type = update.authorization_state['_'];
      try {
        if (type === 'authorizationStateWaitPhoneNumber') {
          await client.invoke({ _: "setAuthenticationPhoneNumber", phone_number: phoneClean });
        } else if (type === 'authorizationStateWaitCode') {
          if (!session.responded) {
            session.responded = true;
            responseData = { success: true };
            resolve();
          }
        } else if (type === 'authorizationStateWaitPassword') {
          session.status = 'password_needed';
          if (!session.responded) {
            session.responded = true;
            responseData = { success: true, requiresPassword: true };
            resolve();
          }
        } else if (type === 'authorizationStateReady') {
          const me = await client.invoke({ _: "getMe" });
          session.user = me;
          session.status = 'done';
          if (!session.responded) {
             session.responded = true;
             responseData = { success: true };
             resolve();
          }
        } else if (type === 'authorizationStateClosing' || type === 'authorizationStateClosed') {
          authSessions.delete(phoneClean);
        }
      } catch (err: any) {
        if (!session.responded) {
          session.responded = true;
          responseData = { error: err.message };
          responseStatus = 500;
          resolve();
        }
      }
    });
  });

  await client.connect();

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (!session.responded) {
        session.responded = true;
        try { client.close(); } catch (e) { }
        authSessions.delete(phoneClean);
        responseData = { error: 'TDLib timeout' };
        responseStatus = 500;
        resolve();
      }
    }, 30000);
  });

  await Promise.race([promise, timeoutPromise]);
  return Response.json(responseData, { status: responseStatus });
}

export async function handleTelegramVerifyCode(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const { phone, code } = await req.json() as any;
  const s = authSessions.get(phone);
  if (!s) return Response.json({ error: 'Session not found' }, { status: 404 });

  try {
    await s.client.invoke({ _: "checkAuthenticationCode", code: String(code) });
    
    for (let i = 0; i < 20; i++) {
      if (s.status === 'done') break;
      if (s.status === 'password_needed') return Response.json({ success: false, requiresPassword: true });
      await new Promise(r => setTimeout(r, 500));
    }

    if (s.status !== 'done') {
      try { await s.client.close(); } catch (e) { }
      authSessions.delete(phone);
      return Response.json({ error: 'Verification timeout' }, { status: 500 });
    }

    const packed = packSession(phone);
    const tgUserId = s.user?.id?.toString();
    const finalUserId = currentUserId || tgUserId;

    if (!finalUserId) {
      return Response.json({ error: 'User info missing' }, { status: 400 });
    }

    await saveAuthSessionData(env, {
      userId: finalUserId,
      firstName: s.user?.first_name,
      username: s.user?.username,
      phone: phone,
      session: packed
    }, currentUserId);

    authSessions.delete(phone);
    setTimeout(async () => { try { await s.client.close(); } catch (e) { } }, 1000);

    if (!currentUserId) {
       return await createSessionResponse(finalUserId, env, true);
    }
    return Response.json({ success: true, userId: finalUserId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

export async function handleTelegramVerifyPassword(env: Env, req: Request, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  const { phone, password, token } = await req.json() as any;
  const sessionId = phone || token;
  const s = authSessions.get(sessionId);
  if (!s) return Response.json({ error: 'Session not found' }, { status: 404 });

  try {
    await s.client.invoke({ _: "checkAuthenticationPassword", password: password });
    
    for (let i = 0; i < 20; i++) {
      if (s.status === 'done') break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (s.status !== 'done') {
      try { await s.client.close(); } catch (e) { }
      authSessions.delete(sessionId);
      return Response.json({ error: 'Password verification timeout' }, { status: 500 });
    }

    const packed = packSession(sessionId);
    const tgUserId = s.user?.id?.toString();
    const finalUserId = currentUserId || tgUserId;

    if (!finalUserId) {
      return Response.json({ error: 'User info missing' }, { status: 400 });
    }

    await saveAuthSessionData(env, {
      userId: finalUserId,
      firstName: s.user?.first_name,
      username: s.user?.username,
      phone: phone || finalUserId,
      session: packed
    }, currentUserId);

    authSessions.delete(sessionId);
    setTimeout(async () => { try { await s.client.close(); } catch (e) { } }, 1000);

    if (!currentUserId) {
       return await createSessionResponse(finalUserId, env, true);
    }
    return Response.json({ success: true, userId: finalUserId });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

export async function handleTelegramQrStart(env: Env): Promise<Response> {
  const tempId = `qr-${Date.now()}`;
  const client = createTdClient(tempId);
  const session: any = { client, status: 'connecting', id: tempId, createdAt: Date.now(), responded: false };
  authSessions.set(tempId, session);

  let responseData: any = null;
  let responseStatus = 200;

  const promise = new Promise<void>((resolve) => {
    client.on('error', (err: any) => {
      console.error(`[/qr-start] TDLib error:`, err);
    });

    client.on('update', async (update: any) => {
      if (update['_'] !== 'updateAuthorizationState') return;
      const type = update.authorization_state['_'];
      try {
        if (type === 'authorizationStateWaitPhoneNumber') {
          await client.invoke({ _: "requestQrCodeAuthentication" });
        } else if (type === 'authorizationStateWaitOtherDeviceConfirmation') {
          session.qrUrl = update.authorization_state.link;
          try {
             session.qrDataUrl = await QRCode.toDataURL(session.qrUrl);
          } catch (e) {}
          session.status = 'qr_ready';
          if (!session.responded) {
             session.responded = true;
             responseData = { qrUrl: session.qrUrl, qrDataUrl: session.qrDataUrl, token: tempId };
             resolve();
          }
        } else if (type === 'authorizationStateReady') {
          const me = await client.invoke({ _: "getMe" });
          session.user = me;
          session.status = 'done';
        } else if (type === 'authorizationStateWaitPassword') {
          session.status = 'password_needed';
        } else if (type === 'authorizationStateClosing' || type === 'authorizationStateClosed') {
          authSessions.delete(tempId);
        }
      } catch (err: any) {
         console.error(`[/qr-start] State handler error:`, err);
      }
    });
  });

  await client.connect();

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      if (!session.responded) {
        session.responded = true;
        try { client.close(); } catch (e) { }
        responseData = { error: 'QR timeout' };
        responseStatus = 500;
        resolve();
      }
    }, 15000);
  });

  await Promise.race([promise, timeoutPromise]);
  return Response.json(responseData, { status: responseStatus });
}

export async function handleTelegramQrCheck(env: Env, token: string | null, currentUserId: string | null, url: URL, ctx: any): Promise<Response> {
  if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });

  if (finishedSessions.has(token)) {
    return Response.json(finishedSessions.get(token));
  }

  const s = authSessions.get(token);
  if (!s) return Response.json({ done: false, expired: true });

  if (s.status === 'password_needed') {
      return Response.json({ done: false, requiresPassword: true });
  }

  if (s.status === 'done') {
    const packed = packSession(s.id);
    const tgUserId = s.user?.id?.toString();
    const finalUserId = currentUserId || tgUserId;

    if (!finalUserId) return Response.json({ done: false, error: 'User info missing' });

    await saveAuthSessionData(env, {
      userId: finalUserId,
      firstName: s.user?.first_name,
      username: s.user?.username,
      session: packed
    }, currentUserId);

    const resp = { done: true, session: packed, userId: finalUserId, firstName: s.user?.first_name };
    finishedSessions.set(token, resp);
    setTimeout(() => finishedSessions.delete(token), 10000);

    authSessions.delete(token);
    try { await s.client.close(); } catch (e) { }

    if (!currentUserId) {
        return await createSessionResponse(finalUserId, env, true);
    }
    return Response.json(resp);
  }

  if (Date.now() - (s.createdAt || 0) > 300000) {
    authSessions.delete(token);
    try { await s.client.close(); } catch (e) { }
    return Response.json({ done: false, expired: true });
  }

  return Response.json({ done: false });
}

export async function handleTelegramVerifyEmail(env: Env, req: Request): Promise<Response> {
  return Response.json({ error: "Email verification not implemented" }, { status: 400 });
}

// Stubs for removed flows
export async function handleGoogleCallback(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleEmailSend(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleEmailVerify(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleRegister(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleLogin(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleForgotPassword(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleResetPassword(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleThreadsLogin(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleThreadsCallback(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleLogout(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleMetaLogin(): Promise<Response> { return new Response("Moved", { status: 410 }); }
export async function handleMetaCallback(): Promise<Response> { return new Response("Moved", { status: 410 }); }
