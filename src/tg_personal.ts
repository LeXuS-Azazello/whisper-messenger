import { Env } from "./types";

export async function sendViaPersonalAccount(
  userId: string,
  chatId: string,
  text: string,
  env: Env
): Promise<boolean> {
  try {
    // 1. Try user-specific session, then fallback to global admin session
    const sessionStr = (userId ? await env.STATS.get(`tg_session_${userId}`) : null) 
                    || await env.STATS.get("admin_tg_session")
                    || await env.STATS.get("tg_personal_session");
                    
    if (!sessionStr) {
      console.warn(`[tg_personal] No session found for user=${userId} or admin`);
      return false;
    }

    const bridgeUrl = env.BRIDGE_URL;

    const res = await fetch(`${bridgeUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": env.BRIDGE_SECRET,
      },
      body: JSON.stringify({
        userId: userId || "admin", // Tell bridge which pod to use
        chatId: parseInt(chatId),
        text: text,
        session: sessionStr // Pass session just in case bridge needs to resume
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[tg_personal] Send failed: ${res.status} ${error}`);
      return false;
    }

    const data: any = await res.json();
    return data.success || true;
  } catch (err: any) {
    console.error(`[tg_personal] Error: ${err.message}`);
    return false;
  }
}
