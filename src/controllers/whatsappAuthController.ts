import { Env } from "../types";

let manager: any = null;

function getManager(env: Env): any {
  if (!manager) {
    try {
      const { WhatsAppManager } = require("../../../whatsapp-client-manager/src/whatsappManager");
      manager = new WhatsAppManager(env);
    } catch (e) {
      console.warn("[WhatsApp] Failed to load WhatsAppManager:", e);
    }
  }
  return manager;
}

export async function handleWaStatus(env: Env, userId: string): Promise<Response> {
  const mgr = getManager(env);
  if (!mgr) {
    return Response.json({ error: "WhatsApp manager not available" }, { status: 500 });
  }

  const connected = mgr.isConnected(userId);
  return Response.json({ connected });
}

export async function handleWaInit(env: Env, userId: string): Promise<Response> {
  const mgr = getManager(env);
  if (!mgr) {
    return Response.json({ error: "WhatsApp manager not available" }, { status: 500 });
  }

  try {
    const result = await mgr.initUserClient(userId);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleWaQR(env: Env, userId: string): Promise<Response> {
  const mgr = getManager(env);
  if (!mgr) {
    return Response.json({ error: "WhatsApp manager not available" }, { status: 500 });
  }

  const qr = mgr.getQR(userId);
  if (!qr) {
    return Response.json({ error: "QR not available" }, { status: 404 });
  }
  return Response.json({ qr });
}

export async function handleWaDisconnect(env: Env, userId: string): Promise<Response> {
  const mgr = getManager(env);
  if (!mgr) {
    return Response.json({ error: "WhatsApp manager not available" }, { status: 500 });
  }

  await mgr.stopClient(userId);
  return Response.json({ status: "disconnected" });
}