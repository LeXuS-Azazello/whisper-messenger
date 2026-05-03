import { Env } from "../types";
import { incrementUserStats } from "./dashboard";

export async function handleInternalRoutes(env: Env, req: Request, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith("/internal/")) return null;

  if (url.pathname === "/internal/stats" && req.method === "POST") {
    const { userId, secret, platform } = await req.json() as any;
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    await incrementUserStats(userId, env, platform || "telegram");
    return Response.json({ ok: true });
  }
  
  if (url.pathname === "/internal/user-meta" && req.method === "GET") {
    const userId = url.searchParams.get("userId");
    const secret = url.searchParams.get("secret");
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    const data = await env.STATS.get(`user_meta_${userId}`);
    return new Response(data, { headers: { "Content-Type": "application/json" } });
  }

  if (url.pathname === "/internal/config" && req.method === "GET") {
    const secret = url.searchParams.get("secret");
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    
    const provider = await env.STATS.get("config_whisper_provider") || "qwen3-asr";
    const model = await env.STATS.get("config_ollama_model") || "qwen3-coder:30b";
    const localUrl = await env.STATS.get("config_local_whisper_url") || "";
    const localSecret = await env.STATS.get("config_local_whisper_secret") || "";
    const ollamaUrl = await env.STATS.get("config_ollama_url") || "";
    
    return Response.json({ provider, model, localUrl, localSecret, ollamaUrl });
  }

  if (url.pathname === "/internal/active-users" && req.method === "GET") {
    const secret = url.searchParams.get("secret");
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    
    const userIdsRaw = await env.STATS.get("users_list");
    let userIds: string[] = [];
    try {
      userIds = userIdsRaw ? JSON.parse(userIdsRaw) : [];
    } catch (e) {
      console.error("Failed to parse users_list:", userIdsRaw?.slice(0, 100));
      return Response.json([]);
    }

    const users: any[] = [];
    for (const id of userIds) {
      const meta = await env.STATS.get(`user_meta_${id}`);
      if (meta) {
        try {
          const u = JSON.parse(meta);
          if (u && u.isActive) {
            const session = await env.STATS.get(`tg_session_${id}`);
            if (session) users.push({ userId: id, session });
          }
        } catch (e) {
          console.error(`Failed to parse user meta for ${id}:`, meta.slice(0, 100));
        }
      }
    }
    return Response.json(users);
  }

  if (url.pathname === "/internal/debug-user" && req.method === "GET") {
    const id = url.searchParams.get("userId");
    const secret = url.searchParams.get("secret");
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    
    const meta = await env.STATS.get(`user_meta_${id}`);
    const session = await env.STATS.get(`tg_session_${id}`);
    
    return Response.json({ 
      userId: id, 
      meta: meta ? JSON.parse(meta) : null, 
      hasSession: !!session,
      sessionPrefix: session ? session.substring(0, 10) : null
    });
  }

  if (url.pathname === "/internal/repair" && req.method === "GET") {
    const secret = url.searchParams.get("secret");
    if (secret !== env.BRIDGE_SECRET) return new Response("Unauthorized", { status: 401 });
    
    const userIdsRaw = await env.STATS.get("users_list");
    const userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];
    const fixed: string[] = [];

    for (const id of userIds) {
      const meta = await env.STATS.get(`user_meta_${id}`);
      if (meta) {
        try {
          JSON.parse(meta);
        } catch (e) {
          console.warn(`Repairing corrupted meta for ${id}`);
          const session = await env.STATS.get(`tg_session_${id}`);
          const defaultMeta = { 
            userId: id, 
            isActive: !!session, 
            session: session || "",
            transcriptionCount: 0,
            lastStartedAt: Date.now()
          };
          await env.STATS.put(`user_meta_${id}`, JSON.stringify(defaultMeta));
          fixed.push(id);
          continue;
        }
      }
    }
    return Response.json({ success: true, fixed, total: userIds.length });
  }

  return null;
}
