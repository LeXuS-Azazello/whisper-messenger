import { Env, UserSession } from "../types";
import { logError } from "../logger";
import { createSignedSession } from "../session";

async function sendEmail(env: Env, to: string, subject: string, htmlBody: string): Promise<boolean> {
  try {
    const mailReq = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.EMAIL_FROM || 'no-reply@voicemsg.net', name: 'Voice Messenger' },
      subject: subject,
      content: [{ type: 'text/html', value: htmlBody }]
    };

    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mailReq)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Email] Send failed:', errorText);
      return false;
    }

    console.log('[Email] Sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('[Email] Send error:', error);
    return false;
  }
}

interface SendCodeRequest { phone: string; }
interface VerifyCodeRequest { phone: string; code: string; }
interface VerifyPasswordRequest { phone?: string; token?: string; password: string; }
interface EmailSendRequest { email: string; }
interface RegisterRequest { email: string; password: string; firstName: string; }
interface LoginRequest { email: string; password: string; }
interface ForgotPasswordRequest { email: string; }
interface ResetPasswordRequest { token: string; password: string; }
interface BridgeUserData { userId: string; firstName: string; session: string; phone?: string; success?: boolean; error?: string; done?: boolean; }

const SESSION_MAX_AGE = 31536000;
const EMAIL_VERIFY_TTL = 900;
const RATE_LIMIT_TTL = 60;

function getPublicOrigin(env: Env, fallbackOrigin: string): string {
  const configured = (env.WORKER_URL || "").trim();
  if (!configured) return fallbackOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return fallbackOrigin;
  }
}

// handleAuthPage removed as requested. Redirect to / or /dashboard instead.





async function handleGoogleCallback(
  env: Env,
  oauth: { code?: string; credential?: string },
  url: URL,
  currentUserId: string | null | undefined
): Promise<Response> {
  const publicOrigin = getPublicOrigin(env, url.origin);
  // If already logged in, redirect to dashboard
  if (currentUserId) {
    return Response.redirect(`${publicOrigin}/dashboard`, 302);
  }

  try {
    let sub = "";
    let email = "";
    let givenName = "";
    let name = "";

    if (oauth.credential) {
      const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(oauth.credential)}`);
      if (!tokenInfoRes.ok) {
        const errorText = await tokenInfoRes.text();
        return new Response(`Token verification failed: ${errorText}`, { status: 400 });
      }

      const tokenInfo = await tokenInfoRes.json() as any;
      if (tokenInfo.aud !== env.GOOGLE_CLIENT_ID) {
        throw new Error("Invalid Google Client ID (audience mismatch)");
      }

      sub = tokenInfo.sub || "";
      email = tokenInfo.email || "";
      givenName = tokenInfo.given_name || tokenInfo.name || (email ? email.split('@')[0] : "Google User");
      name = tokenInfo.name || givenName;
    } else if (oauth.code) {
      const redirectUri = `${publicOrigin}/auth/google/callback`;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          code: oauth.code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri
        })
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        return new Response(`Token exchange failed: ${errorText}`, { status: tokenRes.status });
      }

      const tokenData: any = await tokenRes.json();
      if (!tokenData.access_token) {
        return new Response("No access token in response", { status: 400 });
      }

      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });

      if (!userRes.ok) {
        const errorText = await userRes.text();
        return new Response(`User info failed: ${errorText}`, { status: 400 });
      }

      const userInfo = await userRes.json() as any;
      sub = userInfo.id || "";
      email = userInfo.email || "";
      givenName = userInfo.given_name || userInfo.name || (email ? email.split('@')[0] : "Google User");
      name = userInfo.name || givenName;
    } else {
      return new Response("No Google credential or authorization code provided", { status: 400 });
    }

    if (!sub) {
      return new Response("Google response missing user identifier", { status: 400 });
    }

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

    console.log(`[Auth] Creating session for user: ${userId}`);
    await logError("auth", `User ${userId} authenticated via Google`, env);
    return await createSessionResponse(userId, env);

  } catch (error) {
    console.error(`[Auth] Google error: ${error}`);
    await logError("auth", `Google auth error: ${error}`, env);
    return new Response(`Auth Error: ${error}`, { status: 500 });
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

  const publicOrigin = getPublicOrigin(env, url.origin);
  const verifyLink = `${publicOrigin}/auth/email/verify?token=${token}`;
  const htmlBody = `
    <h2>Email Verification</h2>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verifyLink}">Verify Email</a>
    <p>This link will expire in 15 minutes.</p>
  `;

  const emailSent = await sendEmail(env, email, "Verify Your Email", htmlBody);
  if (!emailSent) {
    return Response.json({ error: "Failed to send email" }, { status: 500 });
  }

  return Response.json({ success: true });
}

async function handleEmailVerify(env: Env, token: string | null, url: URL): Promise<Response> {
  if (!token) return new Response("Missing token", { status: 400 });

  const email = await env.STATS.get(`email_verify_${token}`);
  if (!email) return new Response("Invalid or expired link", { status: 400 });

  await env.STATS.delete(`email_verify_${token}`);
  const userId = `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

  const existingRaw = await env.STATS.get(`user_meta_${userId}`);
  if (existingRaw) {
    // Update existing user to mark email as verified
    const user: UserSession = JSON.parse(existingRaw);
    user.emailVerified = true;
    user.email = email;
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
  } else {
    // Create new user (legacy behavior)
    const user: UserSession = {
      userId, firstName: email.split("@")[0], email,
      session: "", platform: "telegram", transcriptionCount: 0,
      isActive: false, createdAt: Date.now(), lastActiveAt: Date.now(),
      emailVerified: true
    };
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
    const listRaw = await env.STATS.get("users_list") || "[]";
    const list = JSON.parse(listRaw);
    if (!list.includes(userId)) {
      list.push(userId);
      await env.STATS.put("users_list", JSON.stringify(list));
    }
  }

  return new Response("Email verified successfully", { status: 200 });
}

async function handleRegister(env: Env, body: RegisterRequest, url: URL): Promise<Response> {
  const { email, password, firstName } = body;

  if (!email || !email.includes("@") || !password || password.length < 6 || !firstName) {
    return Response.json({ error: "Invalid input. Email, password (min 6 chars), and first name required." }, { status: 400 });
  }

  const userId = `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;

  // Check if user already exists
  const existingRaw = await env.STATS.get(`user_meta_${userId}`);
  if (existingRaw) {
    const existingUser: UserSession = JSON.parse(existingRaw);
    if (existingUser.emailVerified) {
      return Response.json({ error: "User already exists and is verified" }, { status: 409 });
    }
    // Allow re-registration if not verified
  }

  // Hash the password
  const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const passwordHashHex = Array.from(new Uint8Array(passwordHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  const user: UserSession = {
    userId,
    firstName,
    email,
    passwordHash: passwordHashHex,
    session: "",
    platform: "telegram",
    transcriptionCount: 0,
    isActive: false,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    emailVerified: false
  };

  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

  // Add to users_list if not already there
  const listRaw = await env.STATS.get("users_list") || "[]";
  const list = JSON.parse(listRaw);
  if (!list.includes(userId)) {
    list.push(userId);
    await env.STATS.put("users_list", JSON.stringify(list));
  }

  // Send verification email
  const token = crypto.randomUUID();
  await env.STATS.put(`email_verify_${token}`, email, { expirationTtl: EMAIL_VERIFY_TTL });

  const publicOrigin = getPublicOrigin(env, url.origin);
  const verifyLink = `${publicOrigin}/auth/email/verify?token=${token}`;
  const htmlBody = `
    <h2>Welcome to Voice Messenger!</h2>
    <p>Please click the link below to verify your email address:</p>
    <a href="${verifyLink}">Verify Email</a>
    <p>This link will expire in 15 minutes.</p>
  `;

  const emailSent = await sendEmail(env, email, "Verify Your Email", htmlBody);
  if (!emailSent) {
    return Response.json({ error: "Registration successful but failed to send verification email" }, { status: 500 });
  }

  return Response.json({ success: true, message: "Registration successful. Please check your email to verify your account." });
}

async function handleLogin(env: Env, body: LoginRequest, url: URL): Promise<Response> {
  const { email, password } = body;

  if (!email || !email.includes("@") || !password) {
    return Response.json({ error: "Email and password required" }, { status: 400 });
  }

  const userId = `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const userRaw = await env.STATS.get(`user_meta_${userId}`);

  if (!userRaw) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const user: UserSession = JSON.parse(userRaw);

  if (!user.passwordHash) {
    return Response.json({ error: "This account uses a different login method" }, { status: 401 });
  }

  // Hash the provided password and compare
  const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const passwordHashHex = Array.from(new Uint8Array(passwordHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (passwordHashHex !== user.passwordHash) {
    return Response.json({ error: "Invalid email or password" }, { status: 401 });
  }

  if (!user.emailVerified) {
    return Response.json({ error: "Please verify your email before logging in" }, { status: 403 });
  }

  console.log(`[Auth] Login successful for user: ${userId}`);
  await logError("auth", `User ${userId} logged in with email`, env);
  return await createSessionResponse(userId, env);
}

async function handleForgotPassword(env: Env, body: ForgotPasswordRequest, url: URL): Promise<Response> {
  const { email } = body;

  if (!email || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const rateKey = `rate_forgot_${email}`;
  const rateLimit = await env.STATS.get(rateKey);
  if (rateLimit) return Response.json({ error: "Too many requests, try again later" }, { status: 429 });

  const userId = `email_${email.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const userRaw = await env.STATS.get(`user_meta_${userId}`);

  if (!userRaw) {
    // Don't reveal if email exists or not for security
    return Response.json({ success: true, message: "If the email exists, a reset link has been sent." });
  }

  const user: UserSession = JSON.parse(userRaw);
  if (!user.passwordHash || !user.emailVerified) {
    // Don't reveal account status
    return Response.json({ success: true, message: "If the email exists, a reset link has been sent." });
  }

  // Generate reset token
  const resetToken = crypto.randomUUID();
  await env.STATS.put(`password_reset_${resetToken}`, userId, { expirationTtl: EMAIL_VERIFY_TTL });
  await env.STATS.put(rateKey, "1", { expirationTtl: RATE_LIMIT_TTL });

  const publicOrigin = getPublicOrigin(env, url.origin);
  const resetLink = `${publicOrigin}/auth/reset-password?token=${resetToken}`;
  const htmlBody = `
    <h2>Password Reset</h2>
    <p>You requested a password reset for your Voice Messenger account.</p>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">Reset Password</a>
    <p>This link will expire in 15 minutes.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  const emailSent = await sendEmail(env, email, "Reset Your Password", htmlBody);
  if (!emailSent) {
    return Response.json({ error: "Failed to send reset email" }, { status: 500 });
  }

  return Response.json({ success: true, message: "If the email exists, a reset link has been sent." });
}

async function handleResetPassword(env: Env, body: ResetPasswordRequest, url: URL): Promise<Response> {
  const { token, password } = body;

  if (!token || !password || password.length < 6) {
    return Response.json({ error: "Valid token and password (min 6 chars) required" }, { status: 400 });
  }

  const userId = await env.STATS.get(`password_reset_${token}`);
  if (!userId) {
    return Response.json({ error: "Invalid or expired reset token" }, { status: 400 });
  }

  const userRaw = await env.STATS.get(`user_meta_${userId}`);
  if (!userRaw) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const user: UserSession = JSON.parse(userRaw);

  // Hash the new password
  const passwordHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password));
  const passwordHashHex = Array.from(new Uint8Array(passwordHash)).map(b => b.toString(16).padStart(2, '0')).join('');

  user.passwordHash = passwordHashHex;
  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
  await env.STATS.delete(`password_reset_${token}`);

  console.log(`[Auth] Password reset successful for user: ${userId}`);
  await logError("auth", `User ${userId} reset password`, env);

  return Response.json({ success: true, message: "Password reset successful. You can now log in with your new password." });
}

async function handleMetaLogin(env: Env, url: URL): Promise<Response> {
  const publicOrigin = getPublicOrigin(env, url.origin);
  const redirectUri = encodeURIComponent(`${publicOrigin}/auth/meta/callback`);
  const fbUrl = `https://www.facebook.com/${env.META_API_VERSION}/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&scope=pages_messaging,instagram_manage_messages,pages_show_list,instagram_basic,instagram_manage_comments`;
  return Response.redirect(fbUrl, 302);
}

async function handleMetaCallback(env: Env, code: string, userId: string, url: URL): Promise<Response> {
  const publicOrigin = getPublicOrigin(env, url.origin);
  const redirectUri = `${publicOrigin}/auth/meta/callback`;
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

  return Response.redirect(`${publicOrigin}/dashboard`, 302);
}

async function handleThreadsLogin(env: Env, url: URL): Promise<Response> {
  const publicOrigin = getPublicOrigin(env, url.origin);
  const redirectUri = encodeURIComponent(`${publicOrigin}/auth/threads/callback`);
  const threadsUrl = `https://www.threads.net/oauth/authorize?client_id=${env.META_THREADS_APP_ID}&redirect_uri=${redirectUri}&scope=threads_basic,threads_publish&response_type=code`;
  return Response.redirect(threadsUrl, 302);
}

async function handleThreadsCallback(env: Env, code: string, userId: string, url: URL): Promise<Response> {
  const publicOrigin = getPublicOrigin(env, url.origin);
  const redirectUri = `${publicOrigin}/auth/threads/callback`;
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

  return Response.redirect(`${publicOrigin}/dashboard`, 302);
}

function handleLogout(): Response {
  return new Response("Redirect", { status: 302, headers: { "Location": "/", "Set-Cookie": "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT" } });
}

async function createSessionResponse(userId: string, env: Env, returnJson: boolean = false): Promise<Response> {
  const signedSession = await createSignedSession(userId, env.SESSION_SECRET || "default_session_secret");
  const cookie = `session=${signedSession}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${SESSION_MAX_AGE}`;

  // Track active session for reconciliation
  try {
    await env.STATS.put(`tg_session_${userId}`, signedSession, { expirationTtl: SESSION_MAX_AGE });
  } catch (e) {
    console.warn(`[Auth] Failed to track session for ${userId}:`, e);
  }

  if (returnJson) {
    return Response.json({ success: true, userId }, {
      headers: { "Set-Cookie": cookie }
    });
  }

  // Use HTML intermediate page to ensure Cookie is saved across cross-site redirects
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Redirecting...</title>
        <meta http-equiv="refresh" content="0;url=/dashboard">
      </head>
      <body>
        <script>window.location.href = "/dashboard";</script>
        <p>Signing in, please wait... <a href="/dashboard">click here if not redirected</a></p>
      </body>
    </html>
  `;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Set-Cookie": cookie
    }
  });
}

export async function handlePublicAuth(env: Env, req: Request, currentUserId: string | null, ctx: { waitUntil: (p: Promise<any>) => void }): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;
  const pathname = url.pathname;

  if (method === "GET" && (pathname === "/auth" || pathname === "/auth/reset-password")) {
    return new Response(null, {
      status: 302,
      headers: { "Location": currentUserId ? "/dashboard" : "/" }
    });
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
          const form = await req.formData();
          code = (form.get("code") as string | null) || undefined;
          credential = (form.get("credential") as string | null) || undefined;
        } catch {
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
    let body: EmailSendRequest;
    try {
      body = await req.json() as EmailSendRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      return await handleEmailSend(env, body, url);
    } catch (e: any) {
      console.error("[auth] Email send error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "GET" && pathname === "/auth/email/verify") {
    const token = url.searchParams.get("token");
    return await handleEmailVerify(env, token, url);
  }

  if (method === "POST" && pathname === "/auth/register") {
    let body: RegisterRequest;
    try {
      body = await req.json() as RegisterRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      return await handleRegister(env, body, url);
    } catch (e: any) {
      console.error("[auth] Register error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/login") {
    let body: LoginRequest;
    try {
      body = await req.json() as LoginRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      return await handleLogin(env, body, url);
    } catch (e: any) {
      console.error("[auth] Login error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/forgot-password") {
    let body: ForgotPasswordRequest;
    try {
      body = await req.json() as ForgotPasswordRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
      return await handleForgotPassword(env, body, url);
    } catch (e: any) {
      console.error("[auth] Forgot password error:", e);
      return Response.json({ error: e.message || "Internal auth error" }, { status: 500 });
    }
  }

  if (method === "POST" && pathname === "/auth/reset-password") {
    let body: ResetPasswordRequest;
    try {
      body = await req.json() as ResetPasswordRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
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

  if (method === "POST" && pathname === "/auth/send-code") {
    const { phone } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    console.log(`[Auth] Proxying /send-code to ${bridgeUrl}. Secret set: ${!!env.BRIDGE_SECRET}`);
    const bridgeRes = await fetch(`${bridgeUrl}/send-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": env.BRIDGE_SECRET || "changeme"
      },
      body: JSON.stringify({ phone })
    });
    
    if (!bridgeRes.ok) {
        console.error(`[Auth] Bridge /send-code failed: ${bridgeRes.status} ${bridgeRes.statusText}`);
    }
    const body = await bridgeRes.clone().arrayBuffer();
    const headers: Record<string, string> = {};
    bridgeRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return new Response(body, {
      status: bridgeRes.status,
      statusText: bridgeRes.statusText,
      headers
    });
  }

  if (method === "POST" && pathname === "/auth/verify-code") {
    const { phone, code } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const bridgeRes = await fetch(`${bridgeUrl}/verify-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": env.BRIDGE_SECRET || "changeme"
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
            headers: { 'Content-Type': 'application/json', 'x-bridge-secret': env.BRIDGE_SECRET || 'changeme' },
            body: JSON.stringify({ userId: currentUserId, session: data.session })
          }).catch(e => console.error("[Auth] Spawn error:", e)));
        }
      }
    }

    const body = await bridgeRes.clone().arrayBuffer();
    const headers: Record<string, string> = {};
    bridgeRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return new Response(body, {
      status: bridgeRes.status,
      statusText: bridgeRes.statusText,
      headers
    });
  }

  if (method === "POST" && pathname === "/auth/verify-password") {
    const body = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const bridgeRes = await fetch(`${bridgeUrl}/verify-password`, {
      method: "POST",
      headers: {
        "x-bridge-secret": env.BRIDGE_SECRET || "changeme"
      },
      body: JSON.stringify(body)
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
            headers: { 'Content-Type': 'application/json', 'x-bridge-secret': env.BRIDGE_SECRET || 'changeme' },
            body: JSON.stringify({ userId: currentUserId, session: data.session })
          }).catch(e => console.error("[Auth] Spawn error:", e)));
        }
      }
    }

    const respBody = await bridgeRes.clone().arrayBuffer();
    const headers: Record<string, string> = {};
    bridgeRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return new Response(respBody, {
      status: bridgeRes.status,
      statusText: bridgeRes.statusText,
      headers
    });
  }

if (method === "POST" && pathname === "/auth/qr-start") {
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    console.log(`[Auth] Proxying /qr-start to ${bridgeUrl}. Secret set: ${!!env.BRIDGE_SECRET}`);
    const bridgeRes = await fetch(`${bridgeUrl}/qr-start`, {
      method: "POST",
      headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
    });
    
    if (!bridgeRes.ok) {
        console.error(`[Auth] Bridge /qr-start failed: ${bridgeRes.status} ${bridgeRes.statusText}`);
    }
    const body = await bridgeRes.clone().arrayBuffer();
    const headers: Record<string, string> = {};
    bridgeRes.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return new Response(body, {
      status: bridgeRes.status,
      statusText: bridgeRes.statusText,
      headers
    });
  }

  if (method === "GET" && pathname === "/auth/qr-check") {
    const token = url.searchParams.get("token");
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const bridgeRes = await fetch(`${bridgeUrl}/qr-check?token=${token}&secret=${env.BRIDGE_SECRET || "changeme"}`, {
      headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
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
            headers: { 'Content-Type': 'application/json', 'x-bridge-secret': env.BRIDGE_SECRET || 'changeme' },
            body: JSON.stringify({ userId: currentUserId, session: data.session })
          }).catch(e => console.error("[Auth] Spawn error:", e)));
        }
      }
    }

    const respBody = await bridgeRes.clone().arrayBuffer();
    const respHeaders: Record<string, string> = {};
    bridgeRes.headers.forEach((value, key) => {
      respHeaders[key] = value;
    });
    return new Response(respBody, {
      status: bridgeRes.status,
      statusText: bridgeRes.statusText,
      headers: respHeaders
    });
  }

  if (pathname === "/auth/logout") {
    return handleLogout();
  }

  return new Response("Not found", { status: 404 });
}


