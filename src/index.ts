import { Env } from "./types";
import { verifyWebhook } from "./verify";
import queue from "./queue";
import { handlePublicAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleUserDashboard, incrementUserStats } from "./routes/dashboard";
import { handleTelegram, handleMetaMessaging, handleWhatsApp } from "./routes/webhooks";
import { renderHome } from "./home_ui";
import { verifySession } from "./session";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") return Response.json({ ok: true });
    
    // Proxy for Ollama (OpenAI compatible and native)
    if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/") || url.pathname === "/chat/completions") {
        const ollamaBase = env.OLLAMA_BASE_URL || "http://91.224.11.69:11434";
        let targetPath = url.pathname;
        if (targetPath === "/chat/completions") targetPath = "/v1/chat/completions";
        
        const targetUrl = new URL(targetPath, ollamaBase);
        url.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

        const headers = new Headers(req.headers);
        headers.set("Host", new URL(ollamaBase).host);

        try {
            const response = await fetch(targetUrl.toString(), {
                method: req.method,
                headers: headers,
                body: req.method !== "GET" && req.method !== "HEAD" ? await req.blob() : null,
                redirect: "follow"
            });

            const newHeaders = new Headers(response.headers);
            newHeaders.set("Access-Control-Allow-Origin", "*");
            newHeaders.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            newHeaders.set("Access-Control-Allow-Headers", "*");

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: newHeaders
            });
        } catch (e) {
            return Response.json({ error: (e as Error).message }, { status: 502 });
        }
    }

    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            }
        });
    }

    // Signed session from cookie (handle multiple cookies and edge cases)
    let sessionCookie = null;
    const cookieHeader = req.headers.get('Cookie') || '';
    const sessionMatch = cookieHeader.match(/session=([^;]+)/);
    if (sessionMatch) {
      sessionCookie = sessionMatch[1].trim();
    }
    const userId = sessionCookie ? await verifySession(sessionCookie, env.SESSION_SECRET || "default_session_secret") : null;
    
    // Constant-time comparison for admin session to prevent timing attacks
    const adminCookie = req.headers.get('Cookie')?.match(/admin_session=([^;]+)/)?.[1];
    let isAdmin = false;
    if (adminCookie && env.ADMIN_SECRET) {
      if (adminCookie.length === env.ADMIN_SECRET.length) {
        isAdmin = adminCookie === env.ADMIN_SECRET;
      }
    }

    if (url.pathname === "/") {
        if (userId) return Response.redirect(`${url.origin}/dashboard`);
        return new Response(renderHome(env.GOOGLE_CLIENT_ID, url.origin), { 
            headers: { 
                "Content-Type": "text/html; charset=utf-8",
                "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
            } 
        });
    }

    if (url.pathname === "/auth" && userId) {
        return Response.redirect(`${url.origin}/dashboard`);
    }

    // Public Auth Routes
    if (url.pathname.startsWith("/auth")) {
      const res = await handlePublicAuth(env, req, userId);
      const contentType = res.headers.get("Content-Type");
      if (contentType?.includes("text/html")) {
        const newRes = new Response(res.body, res);
        newRes.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
        return newRes;
      }
      return res;
    }

    // Admin Routes
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(env, req);
    }

    // User Dashboard Routes
    if (url.pathname.startsWith("/dashboard")) {
      return handleUserDashboard(env, req, userId);
    }

    // Internal Stats (called by Bridge User Pods)
    if (url.pathname === "/internal/stats" && req.method === "POST") {
      const { userId, secret } = await req.json() as any;
      if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
      await incrementUserStats(userId, env);
      return Response.json({ ok: true });
    }
    
    if (url.pathname === "/internal/user-meta" && req.method === "GET") {
      const userId = url.searchParams.get("userId");
      const secret = url.searchParams.get("secret");
      if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
      const data = await env.STATS.get(`user_meta_${userId}`);
      return new Response(data, { headers: { "Content-Type": "application/json" } });
    }

    if (url.pathname === "/internal/active-users" && req.method === "GET") {
      const secret = url.searchParams.get("secret");
      if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
      const userIdsRaw = await env.STATS.get("users_list");
      const userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];
      const users: any[] = [];
      for (const id of userIds) {
        const meta = await env.STATS.get(`user_meta_${id}`);
        if (meta) {
          const u = JSON.parse(meta);
          if (u.isActive) {
            const session = await env.STATS.get(`tg_session_${id}`);
            if (session) users.push({ userId: id, session });
          }
        }
      }
      return Response.json(users);
    }

    if (url.pathname === "/test-whisper" && req.method === "POST") {
        if (!isAdmin && !userId) return new Response("Unauthorized", { status: 401 });
        const provider = url.searchParams.get("provider") as "cloudflare" | "local" | "ollama" || "ollama";
        const formData = await req.formData();
        const file = formData.get("file") as File;
        if (!file) return new Response("Missing file", { status: 400 });
        
        try {
            const buffer = await file.arrayBuffer();
            
            // Temporary override just for this test
            const originalProvider = await env.STATS.get("config_whisper_provider");
            await env.STATS.put("config_whisper_provider", provider);
            
            const start = Date.now();
            const { transcribeWithFallback } = await import("./whisper");
            const result = await transcribeWithFallback(buffer, env);
            const elapsed = (Date.now() - start) / 1000;
            
            // Restore provider
            if (originalProvider) await env.STATS.put("config_whisper_provider", originalProvider);
            
            return Response.json({ success: true, provider, elapsed, text: result.text });
        } catch (e) {
            return Response.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
    }

    // Standard Webhooks (Meta, WhatsApp, Telegram Bot)
    if (req.method === "POST") {
      const rawBody = await req.text();
      let body: any;
      try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

      const isTelegram = !!body.update_id;
      if (isTelegram) {
        return handleTelegram(body, env);
      }

      const verifyError = await verifyWebhook(req, rawBody, env);
      if (verifyError) return verifyError;

      if (body.object === "whatsapp_business_account") return handleWhatsApp(body, env);
      if (body.object === "page" || body.object === "instagram" || body.object === "threads") return handleMetaMessaging(body, env);

      return new Response("ok");
    }

    return new Response("404");
  },

  async queue(batch: MessageBatch<any>, env: Env) {
    return queue(batch, env);
  },
} satisfies ExportedHandler<Env>;
