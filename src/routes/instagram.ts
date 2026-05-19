import { Env } from "../types";
import {
  handleInstaStatus,
  handleInstaLogin,
  handleInstaDisconnect
} from "../controllers/instagramAuthController";

export async function handleInstagramAction(env: Env, req: Request, userId: string): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/dashboard/instagram/status" && req.method === "GET") {
    return handleInstaStatus(env, userId);
  }

  if (pathname === "/dashboard/instagram/login" && req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    return handleInstaLogin(env, userId, body);
  }

  if (pathname === "/dashboard/instagram/disconnect" && req.method === "POST") {
    return handleInstaDisconnect(env, userId);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: { "Content-Type": "application/json" }
  });
}