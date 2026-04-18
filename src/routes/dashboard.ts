import { Env, UserSession } from "../types";
import { renderDashboard } from "../dashboard_ui";
import { logError } from "../logger";
import { verifySession } from "../session";

export async function handleUserDashboard(env: Env, req: Request, userId: string | null): Promise<Response> {
  const url = new URL(req.url);

  if (!userId) {
    return new Response(null, { status: 302, headers: { 
        "Location": "/",
        "Set-Cookie": "session=deleted; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"
    } });
  }

  let userStats = await env.STATS.get(`user_meta_${userId}`);
  
  // Retry strategy for CF KV eventual consistency (waits up to 1500ms)
  if (!userStats) {
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 500));
      userStats = await env.STATS.get(`user_meta_${userId}`);
      if (userStats) break;
    }
  }

  if (!userStats) {
    return new Response("<html><body>Session expired or user deleted. <a href='/'>Click here to login again</a>.</body></html>", {
      status: 401,
      headers: { 
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `session=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    });
  }
  const user: UserSession = JSON.parse(userStats);

  // Fetch live pod status for the user
  if (user.session) {
    try {
      const podsRes = await fetch(`${env.BRIDGE_URL}/pods`, {
        headers: { 'x-bridge-secret': env.BRIDGE_SECRET }
      });
      if (podsRes.ok) {
        const podStatuses: any[] = await podsRes.json();
        const pod = podStatuses.find(p => p.userId === userId);
        if (pod) {
          user.isActive = pod.status === 'Running';
          user.currentStatus = pod.status;
        } else {
          user.isActive = false;
          user.currentStatus = 'Stopped';
        }
      }
    } catch (e) {
      console.error('[dashboard] Failed to fetch pod status:', e);
    }
  }

  if (req.method === "POST") {
    if (url.pathname === "/dashboard/save-meta") {
      const { metaToken } = await req.json() as any;
      if (metaToken) {
        // Fetch Page ID from Meta
        const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me?fields=id,name&access_token=${metaToken}`);
        if (res.ok) {
          const data: any = await res.json();
          const pageId = data.id;
          await env.STATS.put(`meta_page_owner_${pageId}`, userId);
          user.metaToken = metaToken;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
          return Response.json({ success: true, pageId, name: data.name });
        }
        return Response.json({ error: "Invalid token" }, { status: 400 });
      }
      user.metaToken = "";
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/save-wa") {
      const { whatsappToken, whatsappPhoneId } = await req.json() as any;
      user.whatsappToken = whatsappToken;
      user.whatsappPhoneId = whatsappPhoneId;
      if (whatsappPhoneId) {
        await env.STATS.put(`wa_phone_owner_${whatsappPhoneId}`, userId);
      }
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/test-wa") {
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
    if (url.pathname === "/dashboard/test-tg") {
      try {
        const session = await env.STATS.get(`tg_session_${userId}`);
        const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId, session })
        });
        if (!res.ok) {
           const text = await res.text();
           return Response.json({ success: false, error: `Bridge error ${res.status}: ${text}` });
        }
        return Response.json({ success: true });
      } catch (e) {
        return Response.json({ success: false, error: (e as Error).message });
      }
    }
    if (url.pathname === "/dashboard/disconnect-tg") {
      try {
        const res = await fetch(`${env.BRIDGE_URL}/delete`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId })
        });
        if (!res.ok) await logError("bridge", `/dashboard/disconnect-tg: bridge responded ${res.status}`, env);
      } catch (e: any) {
        await logError("bridge", `/dashboard/disconnect-tg failed: ${e.message}`, env);
      }
      user.session = "";
      user.isActive = false;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      await env.STATS.delete(`tg_session_${userId}`);
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/restart-tg") {
      try {
        const session = await env.STATS.get(`tg_session_${userId}`);
        if (!session) return Response.json({ error: "No session found" }, { status: 400 });

        await fetch(`${env.BRIDGE_URL}/delete`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId })
        });
        
        await new Promise(r => setTimeout(r, 1000));

        const spawnRes = await fetch(`${env.BRIDGE_URL}/spawn`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId, session })
        });

        if (!spawnRes.ok) {
           const err = await spawnRes.text();
           return Response.json({ success: false, error: `Spawn failed: ${err}` });
        }

        user.isActive = true;
        user.lastStartedAt = Date.now();
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));

        return Response.json({ success: true });
      } catch (e: any) {
        return Response.json({ success: false, error: e.message });
      }
    }
    if (url.pathname === "/dashboard/save-settings") {
      const { translateTo } = await req.json() as any;
      user.translateTo = translateTo || undefined;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
  }

  return new Response(renderDashboard(user), { headers: { 
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
  } });
}

export async function incrementUserStats(userId: string, env: Env, platform: string = "telegram") {
  // Global stats for this platform
  const globalKey = `stats_${platform}`;
  const global = await env.STATS.get(globalKey);
  await env.STATS.put(globalKey, String(parseInt(global || "0", 10) + 1));
  
  // Per-user stats
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    const meta: UserSession = JSON.parse(metaRaw);
    meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
    meta.lastActiveAt = Date.now();
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
  }
}
