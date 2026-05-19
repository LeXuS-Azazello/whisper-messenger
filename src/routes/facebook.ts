import { Env } from "../types";
import {
  handleFbStatus,
  handleFbLogin,
  handleFbDisconnect
} from "../controllers/facebookAuthController";

export async function handleFacebookAction(env: Env, req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/dashboard/facebook/status" && req.method === "GET") {
    return handleFbStatus(env, userId);
  }

  if (pathname === "/dashboard/facebook/login" && req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    return handleFbLogin(env, userId, body);
  }

  if (pathname === "/dashboard/facebook/disconnect" && req.method === "POST") {
    return handleFbDisconnect(env, userId);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}
