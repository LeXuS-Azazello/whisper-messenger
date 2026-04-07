import { Env } from "./types";
import { verifyWebhook } from "./verify";
import queue from "./queue";

import { handlePublicAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleUserDashboard, incrementUserStats } from "./routes/dashboard";
import { handleTelegram, handleMetaMessaging, handleWhatsApp } from "./routes/webhooks";
import { renderHome } from "./home_ui";

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") return Response.json({ ok: true });
    
    let userCookie = req.headers.get('Cookie')?.match(/user_id=([^;]+)/)?.[1];
    if (userCookie === "deleted") userCookie = undefined;

    if (url.pathname === "/") {
        if (userCookie) return Response.redirect(`${url.origin}/dashboard`);
        return new Response(renderHome(env.GOOGLE_CLIENT_ID), { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/auth" && userCookie) {
        return Response.redirect(`${url.origin}/dashboard`);
    }

    // Public Auth Routes
    if (url.pathname.startsWith("/auth")) {
      return handlePublicAuth(env, req);
    }

    // Admin Routes
    if (url.pathname.startsWith("/admin")) {
      return handleAdmin(env, req);
    }

    // User Dashboard Routes
    if (url.pathname.startsWith("/dashboard")) {
      return handleUserDashboard(env, req);
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

    if (url.pathname === "/test-whisper" && req.method === "POST") {
        const provider = url.searchParams.get("provider") as "cloudflare" | "local" || "cloudflare";
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
