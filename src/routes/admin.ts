import { Env, UserSession, HealthChecks } from "../types";
import { ErrorLog, getErrors, logError } from "../logger";
import { renderAdminDashboard, renderAdminLogin } from "../admin_ui";

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieAuth = req.headers.get("Cookie")?.match(/auth=([^;]+)/)?.[1];
  
  if (req.method === "POST" && url.pathname === "/admin/login") {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    if (password === env.ADMIN_SECRET) {
      return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `auth=${env.ADMIN_SECRET}; Path=/; HttpOnly; SameSite=Lax` } });
    }
  }
  
  if (url.pathname === "/admin/logout") {
    return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
  }
  
  if (cookieAuth !== env.ADMIN_SECRET) return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  // --- Admin Telegram Proxy Routes ---
  if (url.pathname === "/admin/ping-bridge") {
    try {
      const res = await fetch(`${env.BRIDGE_URL}/health`, { headers: { 'x-bridge-secret': env.BRIDGE_SECRET }});
      const text = await res.text();
      return new Response(`Bridge: ${res.status} ${text}`);
    } catch (e) {
      return new Response(`Worker Error: ${(e as Error).message}`, { status: 500 });
    }
  }

  if (url.pathname === "/admin/tg-status") {
    const userId = await env.STATS.get("admin_tg_userId");
    const session = await env.STATS.get("admin_tg_session");
    const hasPod = userId ? await fetch(`${env.BRIDGE_URL}/health`).then(r => r.ok).catch(() => false) : false;
    return Response.json({ authenticated: !!session, userId, bridgeAlive: hasPod });
  }

  if (url.pathname === "/admin/tg-send-code" && req.method === "POST") {
    const { phoneNumber } = await req.json() as any;
    return fetch(`${env.BRIDGE_URL}/send-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber })
    });
  }

  if (url.pathname === "/admin/tg-verify-code" && req.method === "POST") {
    const { phoneNumber, code } = await req.json() as any;
    const res = await fetch(`${env.BRIDGE_URL}/verify-code`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
      body: JSON.stringify({ phone: phoneNumber, code })
    });
    const data: any = await res.json();
    if (data.success) {
      await env.STATS.put("admin_tg_userId", data.userId);
      await env.STATS.put("admin_tg_session", data.session);
    }
    return Response.json(data);
  }

  if (url.pathname === "/admin/tg-qr-login" && req.method === "POST") {
    return fetch(`${env.BRIDGE_URL}/qr-start`, {
      method: "POST", headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
  }

  if (url.pathname === "/admin/tg-qr-check") {
    const token = url.searchParams.get("token");
    const res = await fetch(`${env.BRIDGE_URL}/qr-check?token=${token}`, {
      headers: { "x-bridge-secret": env.BRIDGE_SECRET }
    });
    const data: any = await res.json();
    if (data.done) {
      await env.STATS.put("admin_tg_userId", data.userId);
      await env.STATS.put("admin_tg_session", data.session);
    }
    return Response.json(data);
  }

  if (url.pathname === "/admin/tg-logout" && req.method === "POST") {
    const userId = await env.STATS.get("admin_tg_userId");
    if (userId) {
      try {
        await fetch(`${env.BRIDGE_URL}/delete`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId })
        });
      } catch (e) {
        console.error("Failed to delete admin pod:", e);
      }
    }
    await env.STATS.delete("admin_tg_userId");
    await env.STATS.delete("admin_tg_session");
    return Response.json({ success: true });
  }

  if (url.pathname === "/admin/tg-test-msg" && req.method === "POST") {
    const userId = await env.STATS.get("admin_tg_userId");
    const session = await env.STATS.get("admin_tg_session");
    if (!userId || !session) return Response.json({ error: "Not logged in" }, { status: 400 });
    try {
      const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId, session })
      });
      if (!res.ok) {
        const text = await res.text();
        return Response.json({ error: `Bridge returned ${res.status}: ${text}` }, { status: res.status });
      }
      return res;
    } catch (e) {
      return Response.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  const userIdsRaw = await env.STATS.get("users_list");
  const userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];
  const users: UserSession[] = [];
  for (const id of userIds) {
    const meta = await env.STATS.get(`user_meta_${id}`);
    if (meta) users.push(JSON.parse(meta));
  }

  const checks: HealthChecks = {
    VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
    META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
    META_APP_SECRET: Boolean(env.META_APP_SECRET),
    WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
    META_API_VERSION: Boolean(env.META_API_VERSION),
    WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
    TELEGRAM_APP_ID: Boolean(env.TELEGRAM_APP_ID),
    TELEGRAM_APP_HASH: Boolean(env.TELEGRAM_APP_HASH),
    AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
    AI: Boolean(env.AI),
  };

  const platforms = ["messenger", "instagram", "whatsapp", "telegram"];
  const stats: any = {};
  for (const p of platforms) {
    const val = await env.STATS.get(`stats_${p}`);
    stats[p] = parseInt(val || "0", 10);
  }
  
  const errors = await getErrors(env);

  if (url.pathname === "/admin/whisper-config") {
    if (req.method === "GET") {
      const provider = await env.STATS.get("config_whisper_provider") || "cloudflare";
      return Response.json({ provider });
    }
    if (req.method === "POST") {
      const { provider } = await req.json() as any;
      await env.STATS.put("config_whisper_provider", provider);
      return Response.json({ success: true });
    }
  }

  if (url.pathname === "/admin/user-action" && req.method === "POST") {
    const { userId, action } = await req.json() as any;
    if (action === "stop") {
      try {
        const res = await fetch(`${env.BRIDGE_URL}/delete`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId })
        });
        if (!res.ok) {
           await logError("bridge", `/admin/user-action: bridge responded ${res.status}`, env);
        }
      } catch (e: any) {
        await logError("bridge", `/admin/user-action 'stop' failed: ${e.message}`, env);
      }
      
      const u = await env.STATS.get(`user_meta_${userId}`);
      if(u) {
        const meta = JSON.parse(u);
        meta.isActive = false;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
      }
    } else if (action === "delete") {
       // Deep delete: remove from bridge, KV meta, and user list
       try {
         const res = await fetch(`${env.BRIDGE_URL}/delete`, {
           method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
           body: JSON.stringify({ userId })
         });
         if (!res.ok) await logError("bridge", `/admin/user-action 'delete': bridge responded ${res.status}`, env);
       } catch (e: any) {
         await logError("bridge", `/admin/user-action 'delete' failed: ${e.message}`, env);
       }

       await env.STATS.delete(`user_meta_${userId}`);
       await env.STATS.delete(`tg_session_${userId}`);
       const listRaw = await env.STATS.get("users_list") || "[]";
       const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
       await env.STATS.put("users_list", JSON.stringify(list));
    }
    return Response.json({ success: true });
  }

  return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
