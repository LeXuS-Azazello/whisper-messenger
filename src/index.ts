import { Env, ExecutionContext, MessageBatch } from "./types";
import { verifyWebhook } from "./verify";
import queue from "./queue";
import { handlePublicAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleInternalRoutes } from "./routes/internal";
import { handleUserDashboard, incrementUserStats } from "./routes/dashboard";
import { handleTelegram, handleMetaMessaging, handleWhatsApp, handleLine } from "./routes/webhooks";
import { renderHome } from "./components/home/Home";
import { verifySession } from "./session";

/**
 * Resolves the bridge URL for forwarding internal requests.
 * Uses BRIDGE_URL env var, falls back to internal K8s service name.
 */
function getBridgeUrl(env: Env): string {
  return (env.BRIDGE_URL || "").trim() || "http://mtproto-bridge-manager:3000";
}

function getPublicOrigin(env: Env, fallbackOrigin: string): string {
  const configured = (env.WORKER_URL || "").trim();
  if (!configured) return fallbackOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return fallbackOrigin;
  }
}

/**
 * Check if the request path starts with a given prefix.
 * Handles both "/admin" and "/admin/something" correctly.
 */
function pathStartsWith(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  if (pathname.startsWith(prefix + "/")) return true;
  return false;
}

export default {
  async fetch(req: Request, env: Env, ctx: { waitUntil: (p: Promise<any>) => void; passThroughOnException: () => void }): Promise<Response> {
    try {
      const url = new URL(req.url);
      const publicOrigin = getPublicOrigin(env, url.origin);
      const bridgeUrl = getBridgeUrl(env);

      // Health check
      if (url.pathname === "/health") return Response.json({ ok: true });

      // ─── Webhook routes (verify + forward to bridge) ──────────────────────────

      if (url.pathname === "/webhooks/meta" || url.pathname === "/webhooks/whatsapp") {
        if (req.method === "GET") {
          const mode = url.searchParams.get("hub.mode");
          const token = url.searchParams.get("hub.verify_token");
          const challenge = url.searchParams.get("hub.challenge");

          if (mode === "subscribe" && token === env.VERIFY_TOKEN) {
            console.log("[webhooks] Meta verification successful");
            return new Response(challenge);
          }
          console.warn("[webhooks] Meta verification failed");
          return new Response("Forbidden", { status: 403 });
        }

        if (req.method === "POST") {
          const rawBody = await req.text();
          const verifyError = await verifyWebhook(req, rawBody, env);
          if (verifyError) return verifyError;

          let body: any;
          try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

          // Forward verified webhook to bridge
          const webhookPath = url.pathname + url.search;
          return fetch(`${bridgeUrl}${webhookPath}`, {
            method: req.method,
            headers: req.headers,
            body: rawBody
          });
        }
      }

      // Telegram webhook
      if (url.pathname.startsWith("/webhooks/line/")) {
        const userId = url.pathname.split("/").pop();
        if (!userId) return new Response("Missing User ID", { status: 400 });

        const rawBody = await req.text();
        const signature = req.headers.get("x-line-signature");
        if (!signature) return new Response("Missing Signature", { status: 400 });

        let body: any;
        try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

        const userData = await env.STATS?.get(`user_meta_${userId}`);
        if (userData) {
          const user: any = JSON.parse(userData);
          if (user.lineSecret) {
            const encoder = new TextEncoder();
            const key = await crypto.subtle.importKey(
              'raw', encoder.encode(user.lineSecret),
              { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
            );
            const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
            const expectedSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(expectedSignature)));
            if (signature !== expectedSignatureBase64) {
              console.error(`[line] Signature verification failed for user ${userId}`);
              return new Response("Invalid Signature", { status: 401 });
            }
          }
        }

        // Forward LINE webhook to bridge
        return fetch(`${bridgeUrl}${url.pathname}`, {
          method: req.method,
          headers: req.headers,
          body: rawBody
        });
      }

      // ─── Telegram Bot Webhook (for Telegram updates, not LINE) ────────────────
      if (url.pathname.startsWith("/webhooks/telegram")) {
        const rawBody = await req.text();
        let body: any;
        try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

        const update = body;
        if (update.message || update.callback_query) {
          await handleTelegram(update, env);
        }
        return new Response("ok");
      }

      // ─── Meta Threads Webhook ──────────────────────────────────────────────
      if (url.pathname.startsWith("/webhooks/threads")) {
        const rawBody = await req.text();
        let body: any;
        try { body = JSON.parse(rawBody); } catch (e) { return new Response("Bad Request", { status: 400 }); }

        return await handleMetaMessaging(body, env);
      }

      // ─── Internal routes (bridge ↔ worker communication) ────────────────────
      if (pathStartsWith(url.pathname, "/internal")) {
        const internalResponse = await handleInternalRoutes(env, req, url);
        if (internalResponse) return internalResponse;
        // Fall through to 404
      }

      // ─── Auth routes ────────────────────────────────────────────────────────
      if (pathStartsWith(url.pathname, "/auth")) {
        // Extract userId from session cookie
        const sessionCookie = req.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];
        let currentUserId: string | null = null;
        if (sessionCookie) {
          currentUserId = await verifySession(sessionCookie, env.SESSION_SECRET || "default_session_secret");
        }

        return await handlePublicAuth(env, req, currentUserId, ctx);
      }

      // ─── Dashboard routes (authenticated) ──────────────────────────────────
      if (pathStartsWith(url.pathname, "/dashboard")) {
        const sessionCookie = req.headers.get("Cookie")?.match(/session=([^;]+)/)?.[1];
        let currentUserId: string | null = null;
        if (sessionCookie) {
          currentUserId = await verifySession(sessionCookie, env.SESSION_SECRET || "default_session_secret");
        }

        if (!currentUserId) {
          return new Response(null, {
            status: 302,
            headers: { "Location": "/" }
          });
        }

        return await handleUserDashboard(env, req, currentUserId);
      }

      // ─── Admin routes ──────────────────────────────────────────────────────
      if (pathStartsWith(url.pathname, "/admin")) {
        return await handleAdmin(env, req);
      }

      // ─── Bridge API proxy (spawn, delete, etc.) ────────────────────────────
      // These endpoints are called by the frontend JS and need to reach the bridge
      if (url.pathname === "/spawn" || url.pathname === "/delete-pod") {
        const bridgeReq = new Request(`${bridgeUrl}${url.pathname}${url.search}`, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          redirect: "manual"
        });
        bridgeReq.headers.set("x-bridge-secret", env.BRIDGE_SECRET || "changeme");
        bridgeReq.headers.set("x-forwarded-for", req.headers.get("CF-Connecting-IP") || "");
        return await fetch(bridgeReq);
      }

      // ─── Home page (/) ──────────────────────────────────────────────────────
      if (url.pathname === "/") {
        return new Response(renderHome(env.GOOGLE_CLIENT_ID || "", publicOrigin), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // ─── Default: redirect to home ──────────────────────────────────────────
      return new Response(null, {
        status: 302,
        headers: { "Location": "/" }
      });

    } catch (e: any) {
      console.error("Worker error:", e.stack || e.message);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  async queue(batch: any, env: Env) {
    return queue(batch, env);
  },
} as any;