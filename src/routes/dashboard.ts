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
          username: dbUser.username,
          email: dbUser.email,
          emailVerified: dbUser.emailVerified,
          isActive: dbUser.isActive ?? true,
          transcriptionCount: dbUser.transcriptionCount || 0,
          createdAt: dbUser.createdAt ? dbUser.createdAt.getTime() : Date.now(),
          lastActiveAt: dbUser.lastActiveAt ? dbUser.lastActiveAt.getTime() : Date.now(),
          session: tgSession?.sessionData || "",
          platform: "telegram",
          metaToken: dbUser.metaToken,
          whatsappToken: dbUser.whatsappToken,
          whatsappPhoneId: dbUser.whatsappPhoneId,
          lineToken: dbUser.lineToken,
          lineSecret: dbUser.lineSecret,
          threadsToken: dbUser.threadsToken,
          threadsUserId: dbUser.threadsUserId
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
  let user: UserSession = JSON.parse(userStats);


  // If session is empty in KV, try to re-fetch from Redis or MongoDB (to handle eventual consistency)
  if (!user.session) {
    try {
      // Try Redis first
      const redisSession = await env.STATS.get(`tg_session_${userId}`);
      if (redisSession) {
        user.session = redisSession;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      } else {
        // Fallback to MongoDB
        const MessengerSession = (await import("../models/MessengerSession")).default;
        const tgSession = await MessengerSession.findOne({ userId, platform: "telegram" });
        if (tgSession?.sessionData) {
          user.session = tgSession.sessionData;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
        }
      }
    } catch (e) {
      console.error("[Dashboard] Session recovery failed:", e);
    }
  }


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
