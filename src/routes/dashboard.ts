import { Env, UserSession } from "../types";
import { renderDashboard } from "../components/dashboard/Dashboard";
import { logError } from "../logger";
import { verifySession } from "../session";

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
      const { metaToken } = await req.json() as any;
      if (metaToken) {
        // Fetch Page ID from Meta
        const res = await fetch(`https://graph.facebook.com/${env.META_API_VERSION}/me?fields=id,name&access_token=${metaToken}`);
        if (res.ok) {
          const data: any = await res.json();
          const pageId = data.id;
          await env.STATS.put(`meta_page_owner_${pageId}`, userId);
          user.metaToken = metaToken;
          await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
          return Response.json({ success: true, pageId, name: data.name });
        }
        return Response.json({ error: "Invalid token" }, { status: 400 });
      }
      user.metaToken = "";
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/save-wa") {
      const { whatsappToken, whatsappPhoneId } = await req.json() as any;
      user.whatsappToken = whatsappToken;
      user.whatsappPhoneId = whatsappPhoneId;
      if (whatsappPhoneId) {
        await env.STATS.put(`wa_phone_owner_${whatsappPhoneId}`, userId);
      }
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/save-line") {
      const { lineToken, lineSecret } = await req.json() as any;
      user.lineToken = lineToken;
      user.lineSecret = lineSecret;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }
    if (url.pathname === "/dashboard/test-wa") {
      try {
        const { whatsappToken, whatsappPhoneId, testRecipient } = await req.json() as any;
        const targetToken = whatsappToken || user.whatsappToken;
        const targetPhoneId = whatsappPhoneId || user.whatsappPhoneId;
        
        if (!targetToken || !targetPhoneId || !testRecipient) {
          return Response.json({ success: false, error: "Missing token, phone ID, or recipient" }, { status: 400 });
        }

        const { sendWhatsAppMessageSafe } = await import("../whatsapp");
        await sendWhatsAppMessageSafe(targetPhoneId, testRecipient, "✅ WhatsApp connection test successful!", targetToken, env);
        
        return Response.json({ success: true });
      } catch (e: any) {
        return Response.json({ success: false, error: e.message });
      }
    }

    if (url.pathname === "/dashboard/test-translation") {
      const { text, targetLang } = await req.json() as any;

      if (!text || !targetLang) {
        return Response.json({ success: false, error: "Missing text or target language" }, { status: 400 });
      }

      try {
        const ollamaUrl = env.OLLAMA_BASE_URL || "http://100.65.0.209:11434";
        const ollamaModel = env.OLLAMA_MODEL || "qwen3-coder:30b";

        const translateRes = await fetch(`${ollamaUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: ollamaModel,
            messages: [
              { role: "system", content: `Translate the following text to ${targetLang}. Output ONLY the translated text. Do not add any introductions or explanations.` },
              { role: "user", content: text }
            ],
            stream: false
          })
        });

        if (!translateRes.ok) {
          return Response.json({ success: false, error: `Translation service error: ${translateRes.status}` }, { status: 500 });
        }

        const data = await translateRes.json() as any;
        const translated = data.choices?.[0]?.message?.content || "Translation failed";

        return Response.json({ success: true, translated });
      } catch (e: any) {
        console.error("[test-translation] Error:", e);
        return Response.json({ success: false, error: e.message }, { status: 500 });
      }
    }

    if (url.pathname === "/dashboard/save-settings") {
      const { translateTo } = await req.json() as any;
      user.translateTo = translateTo || undefined;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      return Response.json({ success: true });
    }

    if (url.pathname === "/dashboard/disconnect-tg") {
      user.session = "";
      user.isActive = false;
      await env.STATS.put(`user_meta_${userId}`, JSON.stringify(user));
      await env.STATS.delete(`tg_session_${userId}`);
      
      // Tell bridge to delete pods
      await fetch(`http://mtproto-bridge-manager:3000/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
        body: JSON.stringify({ userId })
      }).catch(e => console.error("[Dashboard] Delete pod error:", e));
      
      return Response.json({ success: true });
    }

    if (url.pathname === "/dashboard/test-tg") {
      if (!user.session) return Response.json({ error: "Not connected" }, { status: 400 });
       const res = await fetch(`http://mtproto-bridge-manager:3000/test-tg`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
         body: JSON.stringify({ session: user.session, message: "Test message from dashboard!" })
       });
       const data = await res.json().catch(() => ({ error: "Bridge error" }));
       return Response.json(data, { status: res.status });
    }

    if (url.pathname === "/dashboard/restart-tg") {
      if (!user.session) return Response.json({ error: "Not connected" }, { status: 400 });
      
      // Delete existing and spawn new
      await fetch(`http://mtproto-bridge-manager:3000/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
        body: JSON.stringify({ userId })
      }).catch(() => {});

       const res = await fetch(`http://mtproto-bridge-manager:3000/spawn`, {
         method: "POST",
         headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
         body: JSON.stringify({ userId, session: user.session })
       });
       const data = await res.json().catch(() => ({ error: "Bridge error" }));
       return Response.json(data, { status: res.status });
    }
  }

  return new Response(renderDashboard(user), { headers: { 
    "Content-Type": "text/html; charset=utf-8",
    "Cross-Origin-Opener-Policy": "same-origin-allow-popups"
  } });
}

export async function incrementUserStats(userId: string, env: Env, platform: string = "telegram") {
  // Global stats for this platform
  const globalKey = `stats_${platform}`;
  const global = await env.STATS.get(globalKey);
  await env.STATS.put(globalKey, String(parseInt(global || "0", 10) + 1));
  
  // Per-user stats
  const metaRaw = await env.STATS.get(`user_meta_${userId}`);
  if (metaRaw) {
    const meta: UserSession = JSON.parse(metaRaw);
    meta.transcriptionCount = (meta.transcriptionCount || 0) + 1;
    meta.lastActiveAt = Date.now();
    await env.STATS.put(`user_meta_${userId}`, JSON.stringify(meta));
  }
}
