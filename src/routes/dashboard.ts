import { Env, UserSession } from "../types";
import {
  handleSaveMeta,
  handleSaveWa,
  handleSaveLine,
  handleDisconnectTg,
  handleTestTg,
  handleRestartTg,
  showDashboard,
  incrementUserStats,
  handleChangePassword,
  handleDeleteAccount
} from "../controllers/dashboardController";
import { handleTestWa } from "../controllers/whatsappAuthController";

export { incrementUserStats };

const VALID_LANGS = ['off', 'auto', 'ru', 'uk', 'en', 'de', 'fr', 'es', 'zh', 'ja', 'ko', 'ar', 'tr', 'pl', 'it', 'pt'];

async function handleTranslationSettingsGet(env: Env, userId: string): Promise<Response> {
  const lang = await env.STATS.get(`translate_lang_${userId}`) || 'off';
  return Response.json({ lang, validLangs: VALID_LANGS });
}

async function handleTranslationSettingsPost(env: Env, req: Request, userId: string): Promise<Response> {
  try {
    const { lang } = await req.json() as any;
    const raw = (lang || 'off').toLowerCase().trim();
    const safe = raw === 'translate_off' ? 'off' : raw;
    if (safe !== 'off' && !VALID_LANGS.includes(safe)) {
      return Response.json({ error: `Invalid lang. Use one of: ${VALID_LANGS.join(', ')}` }, { status: 400 });
    }
    await env.STATS.put(`translate_lang_${userId}`, safe);
    return Response.json({ success: true, lang: safe });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function handleUserDashboard(env: Env, req: Request, userId: string | null): Promise<Response> {
  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  if (!userId) {
    return new Response(null, {
      status: 302, headers: {
        "Location": "/",
        "Set-Cookie": "session=deleted; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0"
      }
    });
  }

  let userStats = await env.STATS.get(`user_meta_${userId}`);

  if (!userStats) {
    try {
      const User = (await import("../object-models/User")).default;
      const MessengerSession = (await import("../object-models/MessengerSession")).default;

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
          wordsCount: dbUser.wordsCount || 0,
          clonedMessagesCount: dbUser.clonedMessagesCount || 0,
          balance: dbUser.balance || 0,
          currentPlan: dbUser.currentPlan || "Pay-As-You-Go",
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
          threadsUserId: dbUser.threadsUserId,
          passwordHash: dbUser.passwordHash
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
        const MessengerSession = (await import("../object-models/MessengerSession")).default;
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
      return await handleTestWa(env, req, userId);
    }
    if (pathname === "/dashboard/disconnect-tg") {
      return await handleDisconnectTg(env, userId, user);
    }
    if (pathname === "/dashboard/test-tg") {
      return await handleTestTg(env, user);
    }
    if (pathname === "/dashboard/restart-tg" || pathname === "/dashboard/") {
      return await handleRestartTg(env, userId, user);
    }
    if (pathname === "/dashboard/profile/change-password") {
      return await handleChangePassword(env, req, userId);
    }
    if (pathname === "/dashboard/profile/delete-account") {
      return await handleDeleteAccount(env, req, userId);
    }

    if (pathname === "/dashboard/translation-settings") {
      return await handleTranslationSettingsPost(env, req, userId);
    }

    return new Response(`Not found: ${pathname}`, { status: 404 });
  }

  if (req.method === "GET" && pathname === "/dashboard/translation-settings") {
    return await handleTranslationSettingsGet(env, userId);
  }

  if (req.method === "GET" && pathname === "/dashboard/api/stats") {
    try {
      const Statistic = (await import("../object-models/Statistic")).default;
      const stats = await Statistic.find({ userId }).sort({ createdAt: -1 }).limit(100).lean();

      const aggregation = await Statistic.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
            chars: { $sum: "$charactersCount" },
            duration: { $sum: "$durationSeconds" }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return Response.json({ success: true, logs: stats, dailyStats: aggregation });
    } catch (e: any) {
      return Response.json({ success: false, error: e.message }, { status: 500 });
    }
  }

  if (req.method === "GET" && (pathname === "/dashboard" || pathname === "/dashboard/stats" || pathname === "/dashboard/profile" || pathname === "/dashboard/connections" || pathname === "/dashboard/referrals" || pathname === "/dashboard/billing")) {
    return await showDashboard(user, env);
  }

  return new Response("Not found", { status: 404 });
}
