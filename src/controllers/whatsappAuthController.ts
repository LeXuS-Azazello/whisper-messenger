import { Env } from "../types";

const MANAGER_PORT = 3002;

function getManagerUrl(env: Env) {
  return (env.WA_MANAGER_URL || "").replace(/^"|"$/g, "").trim() || `http://whatsapp-baileys-manager:${MANAGER_PORT}`;
}

export async function handleWaStatus(env: Env, userId: string): Promise<Response> {
  // Placeholder: since WhatsApp Baileys manager doesn't have a /status endpoint yet,
  // we'll check if a pod exists, or just query the manager if we add the endpoint.
  try {
    const res = await fetch(`${getManagerUrl(env)}/pods`, {
        headers: { "x-manager-secret": env.MANAGER_SECRET || "changeme" }
    });
    if (res.ok) {
        const pods = await res.json() as any[];
        const userPod = pods.find(p => p.userId === userId && p.status === 'Running');
        return Response.json({ connected: !!userPod });
    }
  } catch (e) {
    console.error("WaStatus error:", e);
  }
  return Response.json({ connected: false });
}

export async function handleWaInit(env: Env, userId: string): Promise<Response> {
  try {
    const res = await fetch(`${getManagerUrl(env)}/auth/qr-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": env.MANAGER_SECRET || "changeme" },
      body: JSON.stringify({ userId })
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleWaQR(env: Env, userId: string): Promise<Response> {
  // In the new flow, the dashboard polls qr-check with the token returned from init
  // To keep compatibility with existing dashboard (which might just call /qr), 
  // we need the dashboard to pass the token. Wait, dashboard.js does: fetch('/dashboard/whatsapp-web/qr')
  // We'll need to adapt this. For now, just return 404 so dashboard fails gracefully if token is missing.
  return Response.json({ error: "Use /qr-check with token" }, { status: 400 });
}

export async function handleWaQRCheck(env: Env, userId: string, token?: string): Promise<Response> {
  try {
    if (!token) return Response.json({ error: 'Missing token' }, { status: 400 });
    const url = `${getManagerUrl(env)}/auth/qr-check?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId || 'unknown')}`;
    const res = await fetch(url, {
      headers: { "x-manager-secret": env.MANAGER_SECRET || "changeme" }
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleWaDisconnect(env: Env, userId: string): Promise<Response> {
  try {
    const res = await fetch(`${getManagerUrl(env)}/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": env.MANAGER_SECRET || "changeme" },
      body: JSON.stringify({ userId })
    });
    return Response.json(await res.json(), { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleTestWa(env: Env, req: Request, userId: string): Promise<Response> {
  try {
    const { testRecipient } = await req.json() as any;
    if (!testRecipient) {
      return Response.json({ success: false, error: "Missing recipient phone number" }, { status: 400 });
    }

    const cleanUrl = getManagerUrl(env).replace(/\/$/, '') + '/test-wa';

    const response = await fetch(cleanUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-manager-secret": env.MANAGER_SECRET || "changeme"
      },
      body: JSON.stringify({
        userId,
        message: "✅ WhatsApp connection test successful!",
        to: testRecipient
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`WhatsApp Manager error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ success: false, error: e.message });
  }
}

export async function handleWaSendCode(env: Env, userId: string, body: any): Promise<Response> {
  try {
    const res = await fetch(`${getManagerUrl(env)}/auth/send-code`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        "x-manager-secret": env.MANAGER_SECRET || "changeme" 
      },
      body: JSON.stringify({ userId, phone: body.phone })
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}