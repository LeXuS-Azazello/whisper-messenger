import { Env } from "../types";
import MessengerSession from "../models/MessengerSession";
import User from "../models/User";
import AdminVar from "../models/AdminVar";

export async function handleConfig(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.MANAGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Try STATS KV first, then fall back to env or defaults
  const provider = env.WHISPER_PROVIDER || "http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000";
  const localSecret = env.WHISPER_SECRET || "";

  return Response.json({
    provider,
    localSecret,
  });
}

export async function handleActiveUsers(env: Env, _req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  if (secret !== env.MANAGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const sessions = await MessengerSession.find({ isActive: true });
    
    const activeUsers = [];
    for (const session of sessions) {
      const user = await User.findOne({ userId: session.userId });
      // Priority: Redis (STATS KV) -> MongoDB
      const redisSession = await env.STATS.get(`tg_session_${session.userId}`);
      
      activeUsers.push({
        userId: session.userId,
        session: redisSession || session.sessionData,
        firstName: user?.firstName || "User",
        platform: session.platform
      });
    }

    
    return Response.json(activeUsers);
  } catch (e) {
    console.error("[Internal] Error fetching active users:", e);
    return new Response("Internal error", { status: 500 });
  }
}

export async function handleStats(env: Env, req: Request): Promise<Response> {
  try {
    const { userId, secret, platform } = await req.json() as any;
    if (secret !== env.MANAGER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    if (userId) {
      const { incrementUserStats } = await import("./dashboardController");
      await incrementUserStats(userId, env, platform || "telegram");
    }
    
    return Response.json({ success: true });
  } catch (e) {
    console.error("[Internal] Error in handleStats:", e);
    return new Response("Internal error", { status: 500 });
  }
}

export async function handleUserMeta(env: Env, req: Request, url: URL): Promise<Response> {
  const secret = url.searchParams.get("secret");
  const userId = url.searchParams.get("userId");
  
  if (secret !== env.MANAGER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }
  
  try {
    let metaRaw = await env.STATS.get(`user_meta_${userId}`);
    if (metaRaw) {
      return new Response(metaRaw, { headers: { "Content-Type": "application/json" } });
    }
    
    // Fallback to MongoDB
    const dbUser = await User.findOne({ userId });
    if (dbUser) {
      const tgSession = await MessengerSession.findOne({ userId, platform: "telegram" });
      const meta = {
        userId: dbUser.userId,
        firstName: dbUser.firstName || "User",
        email: dbUser.email,
        emailVerified: dbUser.emailVerified ?? false,
        isActive: dbUser.isActive ?? true,
        transcriptionCount: dbUser.transcriptionCount || 0,
        tgTranscriptionCount: dbUser.tgTranscriptionCount || 0,
        waTranscriptionCount: dbUser.waTranscriptionCount || 0,
        fbTranscriptionCount: dbUser.fbTranscriptionCount || 0,
        lineTranscriptionCount: dbUser.lineTranscriptionCount || 0,
        instaTranscriptionCount: dbUser.instaTranscriptionCount || 0,
        createdAt: dbUser.createdAt ? dbUser.createdAt.getTime() : Date.now(),
        lastActiveAt: dbUser.lastActiveAt ? dbUser.lastActiveAt.getTime() : Date.now(),
        session: tgSession?.sessionData || "",
        platform: "telegram",
        preferredTranslationLanguage: dbUser.preferredTranslationLanguage || null,
        preferred_translation_lang: dbUser.preferredTranslationLanguage || null
      };
      // Cache in Redis
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
      return Response.json(meta);
    }
    
    return Response.json({ error: "User not found" }, { status: 404 });
  } catch (e) {
    console.error("[Internal] Error fetching user meta:", e);
    return new Response("Internal error", { status: 500 });
  }
}

export async function handleAccessRevoked(env: Env, req: Request): Promise<Response> {
  try {
    const { userId, secret } = await req.json() as any;
    if (secret !== env.MANAGER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    if (userId) {
      // Clear session in DB and Redis
      await MessengerSession.findOneAndUpdate(
        { userId, platform: "telegram" },
        { $set: { isActive: false, sessionData: "" } }
      );
      
      let metaRaw = await env.STATS.get(`user_meta_${userId}`);
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        meta.session = "";
        meta.isActive = false;
        await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
      }
      await env.STATS.delete(`tg_session_${userId}`);
      
      // Tell Manager to delete the pod
      const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
      const managerSecret = (env.MANAGER_SECRET || "changeme").trim();
      await fetch(`${managerUrl}/delete?secret=${managerSecret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-manager-secret": managerSecret },
        body: JSON.stringify({ userId })
      }).catch(e => console.error("[Internal] Delete pod error:", e));
      
      console.log(`[Internal] Access revoked for user ${userId}. Pod deletion triggered.`);
    }
    
    return Response.json({ success: true });
  } catch (e) {
    console.error("[Internal] Error in handleAccessRevoked:", e);
    return new Response("Internal error", { status: 500 });
  }
}
