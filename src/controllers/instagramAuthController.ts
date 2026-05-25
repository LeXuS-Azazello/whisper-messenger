import { Env } from "../types";

const MANAGER_PORT = 3005;

function getManagerUrl(env: Env) {
  return (env.INSTA_MANAGER_URL || "").replace(/^"|"$/g, "").trim() || `http://instagram-fca-manager:${MANAGER_PORT}`;
}

export async function handleInstaStatus(env: Env, userId: string): Promise<Response> {
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
    console.error("InstaStatus error:", e);
  }
  return Response.json({ connected: false });
}

export async function handleInstaLogin(env: Env, userId: string, body: any): Promise<Response> {
  try {
    const { username, password, appState } = body;

    // If appState is provided, prefer it (more stable for Instagram too)
    const payload: any = { userId };
    if (appState) payload.appState = appState;
    else if (username && password) {
      payload.username = username;
      payload.password = password;
    } else {
      return Response.json({ error: "Provide appState or username+password for Instagram" }, { status: 400 });
    }

    const res = await fetch(`${getManagerUrl(env)}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": env.MANAGER_SECRET || "changeme" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleInstaDisconnect(env: Env, userId: string): Promise<Response> {
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