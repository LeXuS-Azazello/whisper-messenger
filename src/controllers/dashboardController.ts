import { Env, UserSession } from "../types";
import { renderDashboard } from "../components/dashboard/Dashboard";

export async function incrementUserStats(userId: string, env: Env, platform: string = "telegram") {
  const globalKey = `stats_${platform}`;
  const global = await env.STATS.get(globalKey);
  await env.STATS.put(globalKey, String(parseInt(global || "0", 10) + 1));
  
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    const meta: UserSession = JSON.parse(metaRaw);
    meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
    meta.lastActiveAt = Date.now();
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
    
    try {
      const User = (await import("../models/User")).default;
      await User.findOneAndUpdate(
        { userId },
        { 
          $inc: { transcriptionCount: 1 },
          $set: { lastActiveAt: new Date(meta.lastActiveAt) }
        },
        { upsert: true }
      );
    } catch (e) {
      console.error("[Stats] Failed to update MongoDB:", e);
    }
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
    await User.findOneAndUpdate({ userId }, { $set: { lineToken, lineSecret } });
  } catch (e) { console.error("[DB] LINE settings persist failed:", e); }

  return Response.json({ success: true });

}

export async function handleTestWa(env: Env, req: Request, user: UserSession): Promise<Response> {
  try {
    const { whatsappToken, whatsappPhoneId, testRecipient } = await req.json() as any;
    const targetToken = whatsappToken || user.whatsappToken;
    const targetPhoneId = whatsappPhoneId || user.whatsappPhoneId;
    
    if (!targetToken || !targetPhoneId || !testRecipient) {
      return Response.json({ success: false, error: "Missing token, phone ID, or recipient" }, { status: 400 });
    }

    const { sendWhatsAppMessageSafe } = await import("../whatsapp");
    await sendWhatsAppMessageSafe(targetPhoneId, testRecipient, "✅ WhatsApp connection test successful!", targetToken, env);
    
    return Response.json({ success: true });
  } catch (e: any) {
    return Response.json({ success: false, error: e.message });
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
  const managerUrl = (env.MANAGER_URL || "").trim() || "http://tg-client-manager.debugging-testcrash-pub.svc.cluster.local:3000";
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
  const managerUrl = (env.MANAGER_URL || "").trim() || "http://tg-client-manager.debugging-testcrash-pub.svc.cluster.local:3000";
  const secret = (env.MANAGER_SECRET || "changeme").trim();
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
}

export async function handleRestartTg(env: Env, userId: string, user: UserSession): Promise<Response> {
  if (!user.session) return Response.json({ error: "Not connected" }, { status: 400 });
  const managerUrl = (env.MANAGER_URL || "").trim() || "http://tg-client-manager.debugging-testcrash-pub.svc.cluster.local:3000";
  const secret = (env.MANAGER_SECRET || "changeme").trim();
  
  // No need for separate delete, spawn handles it
  const res = await fetch(`${managerUrl}/spawn?secret=${secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-manager-secret": secret },
    body: JSON.stringify({ userId, session: user.session })
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
}

export function showDashboard(user: UserSession): Response {
    try {
        const html = renderDashboard(user);
        return new Response(html, { headers: { 
            "Content-Type": "text/html; charset=utf-8",
            "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
        } });
    } catch (e: any) {
        console.error("[Dashboard] Rendering failed:", e);
        return new Response(`<html><body><h1>Dashboard Error</h1><p>${e.message}</p><a href="/">Back to Home</a></body></html>`, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
}
