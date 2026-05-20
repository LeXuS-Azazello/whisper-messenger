import { Env } from "../types";
import {
  handleWaStatus,
  handleWaInit,
  handleWaQR,
  handleWaQRCheck,
  handleWaDisconnect,
  handleWaSendCode
} from "../controllers/whatsappAuthController";

export async function handleWhatsAppWebAction(env: Env, req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/dashboard/whatsapp-web/status" && req.method === "GET") {
    return handleWaStatus(env, userId);
  }

  if (pathname === "/dashboard/whatsapp-web/init" && req.method === "POST") {
    return handleWaInit(env, userId);
  }

  if (pathname === "/dashboard/whatsapp-web/qr" && req.method === "GET") {
    return handleWaQR(env, userId);
  }

  if (pathname === "/dashboard/whatsapp-web/qr-check" && req.method === "GET") {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || undefined;
    return handleWaQRCheck(env, userId, token);
  }

  if (pathname === "/dashboard/whatsapp-web/disconnect" && req.method === "POST") {
    return handleWaDisconnect(env, userId);
  }

  if (pathname === "/dashboard/whatsapp-web/send-code" && req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    return handleWaSendCode(env, userId, body);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}