import { Env } from "../types";
import { renderAuthPage } from "../components/auth/Auth";
import {
  getPublicOrigin,
  handleGoogleCallback,
  handleEmailSend,
  handleEmailVerify,
  handleRegister,
  handleLogin,
  handleForgotPassword,
  handleResetPassword,
  handleMetaLogin,
  handleMetaCallback,
  handleThreadsLogin,
  handleThreadsCallback,
  handleLogout
} from "../controllers/authController";
import {
  handleTelegramSendCode,
  handleTelegramVerifyCode,
  handleTelegramVerifyPassword,
  handleTelegramQrStart,
  handleTelegramQrCheck,
  handleTelegramVerifyEmail
} from "../controllers/telegramAuthController";

export async function handlePublicAuth(env: Env, req: Request, currentUserId: string | null, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const publicOrigin = getPublicOrigin(env, url.origin);

  // Normalize pathname: remove trailing slash
  let pathname = url.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  // Handle all authentication GET requests
  if (method === "GET") {
    // If the user has a valid active session, direct them to their dashboard
    if (currentUserId) {
      return new Response(null, {
        status: 302,
        headers: { "Location": "/dashboard" }
      });
    }

    const successType = url.searchParams.get('success');
    const action = url.searchParams.get('action');

    const authGetPaths = ["/auth", "/login", "/register", "/signup", "/forgot-password", "/reset-password", "/auth/reset-password"];
    const isAuthGet = authGetPaths.includes(pathname);

    if (isAuthGet) {
      // Determine the default active view
      let activeView: 'login' | 'register' | 'forgot' | 'reset' | 'success' = 'login';
      if (pathname === '/register' || pathname === '/signup' || action === 'register') {
        activeView = 'register';
      } else if (pathname === '/forgot-password' || action === 'forgot') {
        activeView = 'forgot';
      } else if (pathname === '/reset-password' || pathname === '/auth/reset-password' || action === 'reset') {
        activeView = 'reset';
      }

      return new Response(renderAuthPage(undefined, false, publicOrigin, successType || undefined, env.GOOGLE_CLIENT_ID, activeView), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
  }

  // If the path doesn't start with /auth, but it's one of our known routes, add the prefix for matching
  const knownRoutes = [
    "/login", "/register", "/logout", "/email/send", "/email/verify", "/forgot-password", "/reset-password"
  ];
  if (knownRoutes.includes(pathname)) {
    pathname = "/auth" + pathname;
  }

  if (pathname === "/auth/google/callback") {
    let code: string | undefined;
    let credential: string | undefined;

    if (method === "GET") {
      const params = Object.fromEntries(url.searchParams);
      code = params.code;
    } else if (method === "POST") {
      const contentType = (req.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("application/json")) {
        try {
          const body = await req.json() as any;
          code = body.code;
          credential = body.credential;
        } catch {
          return Response.json({ error: "Invalid JSON in POST body" }, { status: 400 });
        }
      } else {
        try {
          const bodyText = await req.text();
          console.log("[Auth] Google callback POST body text:", bodyText);
          const params = new URLSearchParams(bodyText);
          code = params.get("code") || undefined;
          credential = params.get("credential") || undefined;
        } catch (e: any) {
          console.error("[Auth] Failed to parse Google callback body:", e);
          return Response.json({ error: "Invalid form body" }, { status: 400 });
        }
      }
    }

    if (!code && !credential) {
      return new Response(`No Google credential or authorization code provided. Method: ${method}`, { status: 400 });
    }
    return await handleGoogleCallback(env, { code, credential }, url, currentUserId);
  }

  if (method === "POST" && pathname === "/auth/email/send") {
    try {
      const body = await req.json() as any;
      return await handleEmailSend(env, body, url);
    } catch (e: any) {
      console.error("[auth] Email send error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: e.message === "Invalid JSON" ? 400 : 500 });
    }
  }

  if (method === "GET" && pathname === "/auth/email/verify") {
    const token = url.searchParams.get("token");
    return await handleEmailVerify(env, token, url);
  }

  if (method === "POST" && pathname === "/auth/register") {
    try {
      const body = await req.json() as any;
      return await handleRegister(env, body, url);
    } catch (e: any) {
      console.error("[auth] Register error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/login") {
    try {
      const body = await req.json() as any;
      return await handleLogin(env, body, url);
    } catch (e: any) {
      console.error("[auth] Login error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/forgot-password") {
    try {
      const body = await req.json() as any;
      return await handleForgotPassword(env, body, url);
    } catch (e: any) {
      console.error("[auth] Forgot password error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/reset-password") {
    try {
      const body = await req.json() as any;
      return await handleResetPassword(env, body, url);
    } catch (e: any) {
      console.error("[auth] Reset password error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "GET" && pathname === "/auth/meta/login") {
    return await handleMetaLogin(env, url);
  }

  if (method === "GET" && pathname === "/auth/meta/callback") {
    const code = url.searchParams.get("code");
    const userId = currentUserId || req.headers.get("Cookie")?.match(/(?:^|;)\s*user_id=([^;]+)/)?.[1];
    if (!code || !userId) return new Response("Missing parameters", { status: 400 });
    return await handleMetaCallback(env, code, userId, url);
  }

  if (method === "GET" && pathname === "/auth/threads/login") {
    return await handleThreadsLogin(env, url);
  }

  if (method === "GET" && pathname === "/auth/threads/callback") {
    const code = url.searchParams.get("code");
    const userId = currentUserId || req.headers.get("Cookie")?.match(/(?:^|;)\s*user_id=([^;]+)/)?.[1];
    if (!code || !userId) return new Response("Missing parameters", { status: 400 });
    return await handleThreadsCallback(env, code, userId, url);
  }

  if (pathname === "/auth/qr-start") {
    return await handleTelegramQrStart(env);
  }

  if (pathname === "/auth/qr-check") {
    const token = url.searchParams.get("token");
    return await handleTelegramQrCheck(env, token, currentUserId, url, ctx);
  }

  if (pathname === "/auth/send-code") {
    return await handleTelegramSendCode(env, req);
  }

  if (pathname === "/auth/verify-code") {
    return await handleTelegramVerifyCode(env, req, currentUserId, url, ctx);
  }

  if (pathname === "/auth/verify-password") {
    return await handleTelegramVerifyPassword(env, req, currentUserId, url, ctx);
  }

  if (pathname === "/auth/verify-email") {
    return await handleTelegramVerifyEmail(env, req);
  }


  if (pathname === "/auth/logout") {
    return handleLogout();
  }


  return new Response(`Not found: ${pathname}`, { status: 404 });
}
