import { Env, UserSession } from "../types";
import {
    handleSaveMeta,
    handleSaveWa,
    handleSaveLine,
    handleTestWa,
    handleTestTranslation,
    handleSaveSettings,
    handleDisconnectTg,
    handleTestTg,
    handleRestartTg,
    showDashboard,
    incrementUserStats
} from "../controllers/dashboardController";

export { incrementUserStats };

export async function handleUserDashboard(env: Env, req: Request, userId: string | null): Promise<Response> {
  const url = new URL(req.url);

  if (!userId) {
    return new Response(null, { status: 302, headers: { 
        "Location": "/",
        "Set-Cookie": "session=deleted; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"
    } });
  }

  let userStats = await env.STATS.get(`user_meta_${userId}`);
  
  if (!userStats) {
    for (let i = 0; i < 3; i++) {
      await new Promise(r => setTimeout(r, 500));
      userStats = await env.STATS.get(`user_meta_${userId}`);
      if (userStats) break;
    }
  }

  if (!userStats) {
    return new Response("<html><body>Session expired or user deleted. <a href='/'>Click here to login again</a>.</body></html>", {
      status: 401,
      headers: { 
        "Content-Type": "text/html; charset=utf-8",
        "Set-Cookie": `session=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    });
  }
  const user: UserSession = JSON.parse(userStats);

  if (req.method === "POST") {
    if (url.pathname === "/dashboard/save-meta") {
        return await handleSaveMeta(env, req, userId, user);
    }
    if (url.pathname === "/dashboard/save-wa") {
        return await handleSaveWa(env, req, userId, user);
    }
    if (url.pathname === "/dashboard/save-line") {
        return await handleSaveLine(env, req, userId, user);
    }
    if (url.pathname === "/dashboard/test-wa") {
        return await handleTestWa(env, req, user);
    }
    if (url.pathname === "/dashboard/test-translation") {
        return await handleTestTranslation(env, req);
    }
    if (url.pathname === "/dashboard/save-settings") {
        return await handleSaveSettings(env, req, userId, user);
    }
    if (url.pathname === "/dashboard/disconnect-tg") {
        return await handleDisconnectTg(env, userId, user);
    }
    if (url.pathname === "/dashboard/test-tg") {
        return await handleTestTg(env, user);
    }
    if (url.pathname === "/dashboard/restart-tg") {
        return await handleRestartTg(env, userId, user);
    }
    
    return new Response("Not found", { status: 404 });
  }

  if (req.method === "GET" && url.pathname === "/dashboard") {
      return showDashboard(user);
  }

  return new Response("Not found", { status: 404 });
}
