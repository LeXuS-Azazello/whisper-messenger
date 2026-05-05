import { Env } from "./types";
import { verifyWebhook } from "./verify";
import queue from "./queue";
import { handlePublicAuth } from "./routes/auth";
import { handleAdmin } from "./routes/admin";
import { handleInternalRoutes } from "./routes/internal";
import { handleUserDashboard, incrementUserStats } from "./routes/dashboard";
import { handleTelegram, handleMetaMessaging, handleWhatsApp, handleLine } from "./routes/webhooks";
import { renderHome } from "./home_ui";
import { verifySession } from "./session";

function getPublicOrigin(env: Env, fallbackOrigin: string): string {
  const configured = (env.WORKER_URL || "").trim();
  if (!configured) return fallbackOrigin;
  try {
    return new URL(configured).origin;
  } catch {
    return fallbackOrigin;
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const publicOrigin = getPublicOrigin(env, url.origin);

      if (url.pathname === "/health") return Response.json({ ok: true });

      // Proxy all non-webhook requests to Kubernetes backend
      // Only handle webhook authentication here, proxy everything else
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

          // Forward to Kubernetes backend
          return fetch(`https://bridge.voicemsg.net${url.pathname}${url.search}`, {
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
        return fetch(`https://bridge.voicemsg.net${url.pathname}`, {
          method: req.method,
          headers: req.headers,
          body: rawBody
        });
      }

      // Proxy all other requests to Kubernetes backend
      const backendUrl = `https://bridge.voicemsg.net${url.pathname}${url.search}`;
      const backendReq = new Request(backendUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        redirect: "manual"
      });

      // Add X-Forwarded-For
      backendReq.headers.set("X-Forwarded-For", req.headers.get("CF-Connecting-IP") || "");
      backendReq.headers.set("X-Real-IP", req.headers.get("CF-Connecting-IP") || "");

      let response = await fetch(backendReq);

      // Handle redirects
      if (response.status === 301 || response.status === 302) {
        let location = response.headers.get("Location");
        if (location) {
          location = location.replace("https://bridge.voicemsg.net", publicOrigin);
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Location", location);
          return new Response(response.body, { status: response.status, headers: newHeaders });
        }
      }

      return response;
    } catch (e: any) {
      console.error("Worker error:", e.stack || e.message);
      return new Response("Internal Server Error", { status: 500 });
    }
  },

  async queue(batch: MessageBatch<any>, env: Env) {
    return queue(batch, env);
  },
} satisfies ExportedHandler<Env>;

