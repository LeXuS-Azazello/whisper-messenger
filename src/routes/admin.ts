import { Env, UserSession, HealthChecks } from "../types";
import { ErrorLog, getErrors, logError } from "../logger";
import { renderAdminDashboard, renderAdminLogin } from "../admin_ui";
import { createSignedSession, verifySession } from "../session";
import { sampleAudioBase64 } from "../sample_audio";
// @ts-ignore
import ADMIN_JS_CONTENT from "../admin.js";

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const cookieAuth = req.headers.get("Cookie")?.match(/admin_session=([^;]+)/)?.[1];
  const adminId = cookieAuth ? await verifySession(cookieAuth, env.ADMIN_SECRET) : null;
  
  if (req.method === "POST" && url.pathname === "/admin/login") {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    if (password === env.ADMIN_SECRET) {
      const signedAdminSession = await createSignedSession("admin", env.ADMIN_SECRET);
      return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=${signedAdminSession}; Path=/; HttpOnly; SameSite=Lax;` } });
    }
  }
  
  if (url.pathname === "/admin/logout") {
    return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
  }
  
  if (adminId !== "admin") return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });

  if (req.method === "POST") {
    const origin = req.headers.get("Origin");
    const host = url.hostname;
    if (origin && !origin.includes(host)) {
       // Only block if it's definitely a cross-origin request to the API
       // We'll allow it if it includes the host or if no origin (some tools)
       await logError("admin", `Potential CSRF block: Origin=${origin} Host=${host}`, env);
       // return new Response("CSRF block", { status: 403 });
    }
  }

  // --- Static Assets Routes ---
  if (url.pathname === "/admin/js") {
    // @ts-ignore - imported via wrangler rules as text
    return new Response(ADMIN_JS_CONTENT, { headers: { "Content-Type": "application/javascript" } });
  }

  if (url.pathname === "/admin/sample-audio") {
    return Response.json({ url: sampleAudioBase64 });
  }

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

  const adminTgUserId = await env.STATS.get("admin_tg_userId");
  const adminTgSession = await env.STATS.get("admin_tg_session");
  let tgAuthenticated = !!adminTgSession;
  
  if (tgAuthenticated && adminTgUserId) {
    try {
      const healthRes = await fetch(`${env.BRIDGE_URL}/health`, {
        headers: { "x-bridge-secret": env.BRIDGE_SECRET }
      });
      const healthData: any = await healthRes.json();
      if (!healthData.alive || !healthData.userId) {
        tgAuthenticated = false;
      }
    } catch (e) {
      tgAuthenticated = false;
    }
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
      // Spawn POD for admin testing
      try {
        const spawnRes = await fetch(`${env.BRIDGE_URL}/spawn`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
          body: JSON.stringify({ userId: data.userId, session: data.session })
        });
        if (!spawnRes.ok) {
          await logError("bridge", `Failed to spawn admin pod: ${await spawnRes.text()}`, env);
        }
      } catch (e) {
        await logError("bridge", `Spawn admin pod failed: ${e instanceof Error ? e.message : String(e)}`, env);
      }
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
    const userMetaRaw = userId ? await env.STATS.get(`user_meta_${userId}`) : null;
    if (userMetaRaw) {
      const userMeta = JSON.parse(userMetaRaw);
      if (!userMeta.isActive) {
        return Response.json({ error: "Pod is not running. Please restart the pod first." }, { status: 400 });
      }
    }
    if (!userId || !session) return Response.json({ error: "Not logged in" }, { status: 400 });
    try {
      const res = await fetch(`${env.BRIDGE_URL}/test-tg`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId, session })
      });
      const text = await res.text();
      if (!res.ok) {
        await logError("admin_tg", `test-tg failed: ${text}`, env);
        return Response.json({ error: `Bridge returned ${res.status}: ${text}` }, { status: res.status });
      }
      try {
        return Response.json(JSON.parse(text));
      } catch {
        return Response.json({ success: true, raw: text });
      }
    } catch (e) {
      return Response.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 500 });
    }
  }

  if (url.pathname === "/admin/tg-test-voice" && req.method === "POST") {
    const userId = await env.STATS.get("admin_tg_userId");
    const session = await env.STATS.get("admin_tg_session");
    if (!userId || !session) return Response.json({ error: "Not logged in" }, { status: 400 });
    try {
      const res = await fetch(`${env.BRIDGE_URL}/test-voice`, {
        method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
        body: JSON.stringify({ userId, session })
      });
      const text = await res.text();
      if (!res.ok) {
        await logError("admin_tg", `test-voice failed: ${text}`, env);
        return Response.json({ error: `Bridge returned ${res.status}: ${text}` }, { status: res.status });
      }
      try {
        return Response.json(JSON.parse(text));
      } catch {
        return Response.json({ success: true, raw: text });
      }
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

  // Fetch live pod statuses
  let podStatuses: any[] = [];
  try {
    const podsRes = await fetch(`${env.BRIDGE_URL}/pods`, {
      headers: { 'x-bridge-secret': env.BRIDGE_SECRET }
    });
    if (podsRes.ok) {
      podStatuses = await podsRes.json();
    }
  } catch (e) {
    console.error('Failed to fetch pod statuses:', e);
  }

  // Update users with live status
  users.forEach(user => {
    const pod = podStatuses.find(p => p.userId === user.userId);
    if (pod) {
      user.isActive = pod.status === 'Running';
      user.currentStatus = pod.status; // Store raw status phase (e.g., 'ContainerCreating')
      if (pod.startTime) {
        user.lastStartedAt = new Date(pod.startTime).getTime();
      }
    } else {
      user.isActive = false;
      user.currentStatus = 'Stopped';
    }
  });

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
      const model = await env.STATS.get("config_ollama_model") || "qwen3-coder:30b";
      return Response.json({ provider, model });
    }
    if (req.method === "POST") {
      const { provider, model } = await req.json() as any;
      if (provider) await env.STATS.put("config_whisper_provider", provider);
      if (model) await env.STATS.put("config_ollama_model", model);
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
        meta.lastStoppedAt = Date.now();
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
      }
    } else if (action === "delete") {
        await logError("admin", `Deleting user ${userId} deep`, env);
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
    } else if (action === "restart") {
       const u = await env.STATS.get(`user_meta_${userId}`);
       if(u) {
         const meta = JSON.parse(u);
         const sessionKey = `tg_session_${userId}`;
         const sessionRaw = await env.STATS.get(sessionKey);
         
         try {
           const res = await fetch(`${env.BRIDGE_URL}/delete`, {
             method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
             body: JSON.stringify({ userId })
           });
           if (!res.ok) {
             await logError("bridge", `/admin/user-action 'restart' (stop): bridge responded ${res.status}`, env);
           }
         } catch (e: any) {
           await logError("bridge", `/admin/user-action 'restart' (stop) failed: ${e.message}`, env);
         }
         
          if(sessionRaw) {
            await new Promise(r => setTimeout(r, 1000));
            try {
              const res = await fetch(`${env.BRIDGE_URL}/spawn`, {
                method: "POST", headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET },
                body: JSON.stringify({ userId, session: sessionRaw })
              });
              if (!res.ok) {
                await logError("bridge", `/admin/user-action 'restart' (spawn): bridge responded ${res.status}`, env);
                meta.isActive = false;
              } else {
                meta.isActive = true;
                meta.lastStartedAt = Date.now();
                delete meta.lastStoppedAt;
              }
            } catch (e: any) {
              await logError("bridge", `/admin/user-action 'restart' (spawn) failed: ${e.message}`, env);
              meta.isActive = false;
            }
          } else {
            meta.isActive = false;
          }
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
       }
    }
    return Response.json({ success: true });
  }

  return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users, tgAuthenticated), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}
