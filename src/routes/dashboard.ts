import { Env, UserSession } from "../types";
import {
    handleSaveMeta,
    handleSaveWa,
    handleSaveLine,
    handleTestWa,
    handleDisconnectTg,
    handleTestTg,
    handleRestartTg,
    showDashboard,
    incrementUserStats
} from "../controllers/dashboardController";

export { incrementUserStats };

export async function handleUserDashboard(env: Env, req: Request, userId: string | null): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  if (!userId) {
    return new Response(null, { status: 302, headers: { 
        "Location": "/",
        "Set-Cookie": "session=deleted; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"
    } });
  }

  let userStats = await env.STATS.get(`user_meta_${userId}`);
  
  if (!userStats) {
    try {
      const User = (await import("../models/User")).default;
      const MessengerSession = (await import("../models/MessengerSession")).default;
      
      const dbUser = await User.findOne({ userId });
      if (dbUser) {
        const tgSession = await MessengerSession.findOne({ userId, platform: "telegram" });
        
        const newUserMeta: UserSession = {
          userId: dbUser.userId,
          firstName: dbUser.firstName || "User",
          email: dbUser.email,
          emailVerified: dbUser.emailVerified,
          isActive: dbUser.isActive,
          transcriptionCount: dbUser.transcriptionCount || 0,
          lastActiveAt: dbUser.lastActiveAt ? dbUser.lastActiveAt.getTime() : undefined,
          session: tgSession?.sessionData || ""
        };
        
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(newUserMeta));
        userStats = JSON.stringify(newUserMeta);
      }
    } catch (e) {
      console.error("[Dashboard] Failed to fetch user from DB:", e);
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
    if (pathname === "/dashboard/save-meta") {
        return await handleSaveMeta(env, req, userId, user);
    }
    if (pathname === "/dashboard/save-wa") {
        return await handleSaveWa(env, req, userId, user);
    }
    if (pathname === "/dashboard/save-line") {
        return await handleSaveLine(env, req, userId, user);
    }
    if (pathname === "/dashboard/test-wa") {
        return await handleTestWa(env, req, user);
    }
    if (pathname === "/dashboard/disconnect-tg") {
        return await handleDisconnectTg(env, userId, user);
    }
    if (pathname === "/dashboard/test-tg") {
        return await handleTestTg(env, user);
    }
    if (pathname === "/dashboard/restart-tg") {
        return await handleRestartTg(env, userId, user);
    }
    
    return new Response(`Not found: ${pathname}`, { status: 404 });
  }

  if (req.method === "GET" && pathname === "/dashboard") {
      return showDashboard(user);
  }

  return new Response("Not found", { status: 404 });
}
