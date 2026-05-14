import { Env } from "../types";
import { handleConfig, handleActiveUsers, handleStats, handleUserMeta } from "../controllers/internalController";

export async function handleInternalRoutes(env: Env, req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/internal/active-users" && req.method === "GET") {
    return handleActiveUsers(env, req, url);
  }

  if (url.pathname === "/internal/config" && req.method === "GET") {
    return handleConfig(env, req, url);
  }

  if (url.pathname === "/internal/stats" && req.method === "POST") {
    return handleStats(env, req);
  }

  if (url.pathname === "/internal/user-meta" && req.method === "GET") {
    return handleUserMeta(env, req, url);
  }

  if (url.pathname === "/internal/access-revoked" && req.method === "POST") {
    const { handleAccessRevoked } = await import("../controllers/internalController");
    return handleAccessRevoked(env, req);
  }

  return null;
}