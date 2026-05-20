import { Env, UserSession } from "../types";
import { renderDashboard } from "../components/dashboard/Dashboard";



export async function incrementUserStats(userId: string, env: Env, platform: string = "telegram") {
  const globalKey = `stats_${platform}`;
  const global = await env.STATS.get(globalKey);
  await env.STATS.put(globalKey, String(parseInt(global || "0", 10) + 1));

  const lastActiveAt = Date.now();
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    try {
      const meta: UserSession = JSON.parse(metaRaw);
      meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
      if (platform === "telegram") {
        meta.tgTranscriptionCount = (meta.tgTranscriptionCount || 0) + 1;
      } else if (platform === "whatsapp") {
        meta.waTranscriptionCount = (meta.waTranscriptionCount || 0) + 1;
      } else if (platform === "facebook") {
        meta.fbTranscriptionCount = (meta.fbTranscriptionCount || 0) + 1;
      } else if (platform === "line") {
        meta.lineTranscriptionCount = (meta.lineTranscriptionCount || 0) + 1;
      } else if (platform === "instagram" || platform === "insta" || platform === "meta") {
        meta.instaTranscriptionCount = (meta.instaTranscriptionCount || 0) + 1;
      }
      meta.lastActiveAt = lastActiveAt;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
    } catch (e) {
      console.error("[Stats] Failed to update KV user_meta:", e);
    }
  }

  try {
    const User = (await import("../models/User")).default;
    const incFields: Record<string, number> = { transcriptionCount: 1 };
    if (platform === "telegram") {
      incFields.tgTranscriptionCount = 1;
    } else if (platform === "whatsapp") {
      incFields.waTranscriptionCount = 1;
    } else if (platform === "facebook") {
      incFields.fbTranscriptionCount = 1;
    } else if (platform === "line") {
      incFields.lineTranscriptionCount = 1;
    } else if (platform === "instagram" || platform === "insta" || platform === "meta") {
      incFields.instaTranscriptionCount = 1;
    }

    await User.findOneAndUpdate(
      { userId },
      {
        $inc: incFields,
        $set: { lastActiveAt: new Date(lastActiveAt) }
      },
      { upsert: true }
    );
  } catch (e) {
    console.error("[Stats] Failed to update MongoDB:", e);
  }
}


export async function handleSaveMeta(env: Env, req: Request, userId: string, user: UserSession): Promise<Response> {
  const { metaToken } = await req.json() as any;
  if (metaToken) {
    const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me?fields=id,name&access_token=${metaToken}`);
    if (res.ok) {
      const data: any = await res.json();
      const pageId = data.id;
      await env.STATS.put(`meta_page_owner_${pageId}`, userId);
      user.metaToken = metaToken;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

      try {
        const User = (await import("../models/User")).default;
        await User.findOneAndUpdate({ userId }, { $set: { metaToken } });
      } catch (e) { console.error("[DB] Meta token persist failed:", e); }

      return Response.json({ success: true, pageId, name: data.name });

    }
    return Response.json({ error: "Invalid token" }, { status: 400 });
  }
  user.metaToken = "";
  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
  return Response.json({ success: true });
}

export async function handleSaveWa(env: Env, req: Request, userId: string, user: UserSession): Promise<Response> {
  const { whatsappToken, whatsappPhoneId } = await req.json() as any;
  user.whatsappToken = whatsappToken;
  user.whatsappPhoneId = whatsappPhoneId;
  if (whatsappPhoneId) {
    await env.STATS.put(`wa_phone_owner_${whatsappPhoneId}`, userId);
  }
  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

  try {
    const User = (await import("../models/User")).default;
    await User.findOneAndUpdate({ userId }, { $set: { whatsappToken, whatsappPhoneId } });
  } catch (e) { console.error("[DB] WA settings persist failed:", e); }

  return Response.json({ success: true });

}

export async function handleSaveLine(env: Env, req: Request, userId: string, user: UserSession): Promise<Response> {
  const { lineToken, lineSecret } = await req.json() as any;
  user.lineToken = lineToken;
  user.lineSecret = lineSecret;
  await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

  try {
    const User = (await import("../models/User")).default;
    const MessengerSession = (await import("../models/MessengerSession")).default;

    await User.findOneAndUpdate({ userId }, { $set: { lineToken, lineSecret } }, { upsert: true });
    await MessengerSession.findOneAndUpdate(
      { userId, platform: "line" },
      { sessionData: JSON.stringify({ lineToken, lineSecret }), isActive: true, identifier: userId },
      { upsert: true }
    );
  } catch (e) {
    console.error("[DB] LINE settings persist failed:", e);
  }

  const managerUrl = (env.LINE_MANAGER_URL || "").trim() || `http://line-manager.${env.NAMESPACE}.svc.cluster.local:3006`;
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  try {
    const res = await fetch(`${managerUrl}/spawn`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": secret },
      body: JSON.stringify({ userId })
    });
    const data = await res.json().catch(() => ({ error: "Manager did not return JSON" }));

    if (!res.ok) {
      console.error("[Dashboard] LINE spawn failed:", data);
      return Response.json({ error: "Failed to spawn LINE client", details: data }, { status: 500 });
    }

    user.isActive = true;
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    console.error("[Dashboard] LINE spawn request failed:", e);
    return Response.json({ error: e.message || "Failed to spawn LINE client" }, { status: 500 });
  }
}


export async function handleDisconnectTg(env: Env, userId: string, user: UserSession): Promise<Response> {
  console.log(`[Dashboard] Disconnecting Telegram for user ${userId}`);

  // 1. Update internal state
  user.session = "";
  user.isActive = false;

  // 2. Clear KV stats (force refresh from DB next time)
  await env.STATS.delete(`user_meta_${userId}`);

  // 3. Clear Redis session
  await env.STATS.delete(`tg_session_${userId}`);

  // 4. Update MongoDB
  try {
    const MessengerSession = (await import("../models/MessengerSession")).default;
    const User = (await import("../models/User")).default;

    await MessengerSession.deleteMany({ userId, platform: "telegram" });
    await User.findOneAndUpdate({ userId }, { $set: { isActive: false } });
    console.log(`[Dashboard] MongoDB session cleared for ${userId}`);
  } catch (e) {
    console.error("[Dashboard] MongoDB cleanup failed:", e);
  }

  // 5. Tell Manager to kill pods and local files
  const managerUrl = (env.MANAGER_URL || "").trim() || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`;
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  await fetch(`${managerUrl}/delete?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manager-secret": secret },
    body: JSON.stringify({ userId })
  }).catch(e => console.error("[Dashboard] Manager delete call failed:", e));

  return Response.json({ success: true });
}

export async function handleTestTg(env: Env, user: UserSession): Promise<Response> {
  if (!user.session) return Response.json({ error: "Not connected" }, { status: 400 });
  const managerUrl = (env.MANAGER_URL || "").trim() || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`;
  const secret = (env.MANAGER_SECRET || "changeme").trim();
  
  try {
    const res = await fetch(`${managerUrl}/test-tg?secret=${secret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": secret },
      body: JSON.stringify({
        userId: user.userId,
        session: user.session,
        message: "✅ Whisper Messenger connection test successful! Your account is now linked and ready to transcribe voice messages."
      })
    });
    const data = await res.json().catch(() => ({ error: "Bridge error" }));
    return Response.json(data, { status: res.status });
  } catch (err) {
    console.error("[Dashboard] Proxy to tg-client-manager failed:", err);
    return Response.json({ error: "Telegram service unavailable" }, { status: 503 });
  }
}

export async function handleRestartTg(env: Env, userId: string, user: UserSession): Promise<Response> {
  if (!user.session) return Response.json({ error: "Not connected" }, { status: 400 });
  const managerUrl = (env.MANAGER_URL || "").trim() || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`;
  const secret = (env.MANAGER_SECRET || "changeme").trim();

  try {
    const res = await fetch(`${managerUrl}/spawn?secret=${secret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": secret },
      body: JSON.stringify({ userId })
    });

    const data = await res.json().catch(() => ({ error: "Bridge error" }));

    if (res.ok && data.success) {
      user.isActive = true;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

      try {
        const User = (await import("../models/User")).default;
        await User.findOneAndUpdate({ userId }, { $set: { isActive: true } });
      } catch (e) { console.error("[DB] Status update failed:", e); }
    }

    return Response.json(data, { status: res.status });
  } catch (err) {
    console.error("[Dashboard] Proxy to tg-client-manager failed:", err);
    return Response.json({ error: "Telegram service unavailable" }, { status: 503 });
  }
}

export function showDashboard(user: UserSession, env: Env): Response {
  try {
    const html = renderDashboard(user, env);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
      }
    });
  } catch (e: any) {
    console.error("[Dashboard] Rendering failed:", e);
    return new Response(`<html><body><h1>Dashboard Error</h1><p>${e.message}</p><a href="/">Back to Home</a></body></html>`, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}

export async function handleChangePassword(env: Env, req: Request, userId: string): Promise<Response> {
  try {
    const { oldPassword, newPassword } = await req.json() as any;
    if (!newPassword || newPassword.length < 6) {
      return Response.json({ success: false, error: "New password must be at least 6 characters long." }, { status: 400 });
    }

    const User = (await import("../models/User")).default;
    const dbUser = await User.findOne({ userId });
    if (!dbUser) {
      return Response.json({ success: false, error: "User not found." }, { status: 404 });
    }

    if (dbUser.passwordHash) {
      if (!oldPassword) {
        return Response.json({ success: false, error: "Old password is required." }, { status: 400 });
      }
      const oldHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(oldPassword));
      const oldHashHex = Array.from(new Uint8Array(oldHash)).map(b => b.toString(16).padStart(2, '0')).join('');
      if (oldHashHex !== dbUser.passwordHash) {
        return Response.json({ success: false, error: "Incorrect old password." }, { status: 401 });
      }
    }

    const newHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPassword));
    const newHashHex = Array.from(new Uint8Array(newHash)).map(b => b.toString(16).padStart(2, '0')).join('');

    dbUser.passwordHash = newHashHex;
    await dbUser.save();

    return Response.json({ success: true, message: "Password updated successfully!" });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function handleDeleteAccount(env: Env, req: Request, userId: string): Promise<Response> {
  try {
    console.log(`[Dashboard] Deleting account for user ${userId}`);

    // 1. Clear KV stats & Redis session
    await env.STATS.delete(`user_meta_${userId}`);
    await env.STATS.delete(`tg_session_${userId}`);

    // 2. MongoDB Cleanup
    const User = (await import("../models/User")).default;
    const MessengerSession = (await import("../models/MessengerSession")).default;

    await MessengerSession.deleteMany({ userId });
    await User.deleteOne({ userId });

    // 3. Contact Manager to kill pods and local files
    const managerUrl = (env.MANAGER_URL || "").trim() || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`;
    const secret = (env.MANAGER_SECRET || "changeme").trim();

    await fetch(`${managerUrl}/delete?secret=${secret}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": secret },
      body: JSON.stringify({ userId })
    }).catch(e => console.error("[Dashboard] Manager delete call failed during account deletion:", e));

    return Response.json({ success: true }, {
      headers: {
        "Set-Cookie": "session=deleted; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
      }
    });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}

