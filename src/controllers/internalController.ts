import { Env } from "../types";

export async function handleConfig(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.BRIDGE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const provider = await env.STATS.get("config_whisper_provider") || "qwen3-asr";
  const model = await env.STATS.get("config_ollama_model") || "whisper";
  const localUrl = await env.STATS.get("config_local_whisper_url") || "";
  const localSecret = await env.STATS.get("config_local_whisper_secret") || "";
  const ollamaUrl = await env.STATS.get("config_ollama_url") || "";

  return Response.json({
    provider,
    model,
    localUrl,
    localSecret,
    ollamaUrl
  });
}

export async function handleActiveUsers(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.BRIDGE_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const usersListRaw = await env.STATS.get("users_list");
    const userIds: string[] = usersListRaw ? JSON.parse(usersListRaw) : [];
    
    const activeUsers = [];
    for (const userId of userIds) {
      const session = await env.STATS.get(`tg_session_${userId}`);
      if (session) {
        const metaRaw = await env.STATS.get(`user_meta_${userId}`);
        if (metaRaw) {
          const meta = JSON.parse(metaRaw);
          activeUsers.push({
            userId: userId,
            session: session,
            firstName: meta.firstName || "",
            platform: meta.platform || "telegram"
          });
        }
      }
    }
    
    return Response.json(activeUsers);
  } catch (e) {
    console.error("[Internal] Error fetching active users:", e);
    return new Response("Internal error", { status: 500 });
  }
}
