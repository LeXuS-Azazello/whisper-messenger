import { Env } from "../types";
import { handleConfig, handleActiveUsers } from "../controllers/internalController";

export async function handleInternalRoutes(env: Env, req: Request, url: URL): Promise<Response | null> {
  if (url.pathname === "/internal/active-users" && req.method === "GET") {
    return handleActiveUsers(env, req, url);
  }

  if (url.pathname === "/internal/config" && req.method === "GET") {
    return handleConfig(env, req, url);
  }

  return null;
}