import { Env } from "../types";

const MANAGER_PORT = 3003;

function getManagerUrl(env: Env) {
  return (env.FB_MANAGER_URL || "").replace(/^"|"$/g, "").trim() || `http://facebook-fca-manager:${MANAGER_PORT}`;
}

export async function handleFbStatus(env: Env, userId: string): Promise<Response> {
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
    console.error("FbStatus error:", e);
  }
  return Response.json({ connected: false });
}

export async function handleFbLogin(env: Env, userId: string, body: any): Promise<Response> {
  try {
    const { appState } = body;

    // Hard reject any attempt to use dead credential login for Facebook
    if (!appState) {
      return Response.json({
        error: "Email/Password login is permanently disabled for Facebook Messenger. Facebook blocks it. Use AppState JSON exported with C3C UFC Utility extension only. See https://github.com/c3cbot/c3c-ufc-utility"
      }, { status: 400 });
    }

    const res = await fetch(`${getManagerUrl(env)}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manager-secret": env.MANAGER_SECRET || "changeme" },
      body: JSON.stringify({ userId, appState })
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleFbDisconnect(env: Env, userId: string): Promise<Response> {
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
