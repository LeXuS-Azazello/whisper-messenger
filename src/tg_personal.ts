import { Env } from "./types";

interface TgSession {
  phone: string;
  session: any;
  userId: number;
  firstName: string;
  authenticatedAt: number;
}

export async function sendViaPersonalAccount(
  chatId: string,
  text: string,
  env: Env
): Promise<boolean> {
  try {
    const sessionStr = await env.STATS.get("tg_personal_session");
    if (!sessionStr) {
      console.warn("[tg_personal] No session found");
      return false;
    }

    const session: TgSession = JSON.parse(sessionStr);
    const bridgeUrl = env.BRIDGE_URL || "https://tg-ws-api.lexus-ffa.workers.dev";

    const res = await fetch(`${bridgeUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bridge-secret": env.BRIDGE_SECRET || "",
      },
      body: JSON.stringify({
        chatId: parseInt(chatId),
        text: text,
        session: session.session,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error(`[tg_personal] Send failed: ${res.status} ${error}`);
      return false;
    }

    const data: any = await res.json();
    console.log(`[tg_personal] Message sent successfully to ${chatId}`);
    return data.success || true;
  } catch (err: any) {
    console.error(`[tg_personal] Error: ${err.message}`);
    return false;
  }
}
