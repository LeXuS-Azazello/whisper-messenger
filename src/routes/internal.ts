import { Env } from "../types";
import { verifySession } from "../session";

export async function handleInternalRoutes(env: Env, req: Request, url: URL): Promise<Response | null> {
  // Internal bridge-only endpoints
  
  if (url.pathname === "/internal/active-users" && req.method === "GET") {
    return handleActiveUsers(env, req, url);
  }

  return null;
}

async function handleActiveUsers(env: Env, _req: Request, url: URL): Promise<Response> {
  // Verify bridge secret
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