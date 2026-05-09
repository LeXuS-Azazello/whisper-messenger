import { Env, UserSession, HealthChecks } from "../types";
import { ErrorLog, getErrors, logError } from "../logger";
import { renderAdminDashboard } from "../components/admin/AdminDashboard";
import { renderAdminLogin } from "../components/admin/AdminLogin";
import { createSignedSession, verifySession } from "../session";
import { sampleAudioBase64 } from "../sample_audio";

export async function fetchUsersWithStatus(env: Env): Promise<UserSession[]> {
    const userIdsRaw = await env.STATS.get("users_list");
    let userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];

    // Limit to most recent 50 users to avoid hitting KV limits
    if (userIds.length > 50) {
        userIds = userIds.slice(-50);
    }

    const users: UserSession[] = [];

    // Fetch all meta in parallel
    const userConfigs = await Promise.all(userIds.map(async (id) => {
        const metaStr = await env.STATS.get(`user_meta_${id}`);
        if (!metaStr) return null;
        try {
            const meta = JSON.parse(metaStr) as UserSession;
            // Also check if TG session exists - but maybe we can optimize this too
            const session = await env.STATS.get(`tg_session_${id}`);
            meta.tgAuthenticated = !!session;
            return meta;
        } catch (e) {
            return null;
        }
    }));

    userConfigs.forEach(u => { if (u) users.push(u); });

    // Fetch live pod statuses from bridge
    try {
        const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
        const podsRes = await fetch(`${bridgeUrl}/pods?secret=${env.BRIDGE_SECRET || "changeme"}`, {
            headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
        });
        if (podsRes.ok) {
            const podStatuses = await podsRes.json() as any[];
            const podMap = new Map(podStatuses.map(p => [String(p.userId), p]));
            
            users.forEach(user => {
                const pod = podMap.get(String(user.userId));
                if (pod) {
                    user.isActive = true;
                    user.currentStatus = pod.status || 'Running';
                    user.lastStartedAt = pod.startTime ? new Date(pod.startTime).getTime() : undefined;
                    user.podName = pod.podName;
                } else {
                    user.isActive = false;
                    user.currentStatus = 'Stopped';
                }
            });
        }
    } catch (e) {
        console.warn("[Admin] Failed to fetch pod statuses:", e);
        users.forEach(user => {
            user.isActive = false;
            user.currentStatus = 'Unknown';
        });
    }

    return users;
}

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
        const cookieAuth = req.headers.get("Cookie")?.match(/admin_session=([^;]+)/)?.[1];
        const adminId = cookieAuth ? await verifySession(cookieAuth, env.ADMIN_SECRET) : null;

        if (req.method === "POST" && url.pathname === "/admin/login") {
            const formData = await req.formData();
            const password = formData.get("password")?.toString();
            if (password === env.ADMIN_SECRET) {
                const signedAdminSession = await createSignedSession("admin", env.ADMIN_SECRET);
                return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=${signedAdminSession}; Path=/; HttpOnly; SameSite=Lax;` } });
            }
        }

        if (url.pathname === "/admin/logout") {
            return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
        }

        if (adminId !== "admin") {
            // If it's an API request, return 401 JSON
            if (req.method === "POST" || url.pathname.endsWith(".json") || url.pathname.includes("/tg-") || url.pathname.includes("/user-action")) {
                return new Response(JSON.stringify({ success: false, error: "Unauthorized. Please login." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
        }

        if (req.method === "POST") {
            const origin = req.headers.get("Origin");
            const host = url.hostname;
            if (origin && !origin.includes(host)) {
                // Only block if it's definitely a cross-origin request to the API
                await logError("admin", `Potential CSRF block: Origin=${origin} Host=${host}`, env);
            }
        }

        // --- Static Assets Routes (Deprecated, using /assets/js/admin.js now) ---
        if (url.pathname === "/admin/js") {
            return new Response("console.warn('/admin/js is deprecated. Use /assets/js/admin.js');", { headers: { "Content-Type": "application/javascript" } });
        }

        if (url.pathname === "/admin/sample-audio") {
            return Response.json({ url: sampleAudioBase64 });
        }

        if (url.pathname === "/admin/tg-status") {
            const res = await fetch(`${bridgeUrl}/health`, {
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-send-code" && req.method === "POST") {
            const { phoneNumber } = await req.json() as any;
            const res = await fetch(`${bridgeUrl}/send-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ phone: phoneNumber })
            });
            return res;
        }

        if (url.pathname === "/admin/tg-verify-code" && req.method === "POST") {
            const { phoneNumber, code } = await req.json() as any;
            const res = await fetch(`${bridgeUrl}/verify-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ phone: phoneNumber, code })
            });
            return res;
        }

        if (url.pathname === "/admin/tg-qr-login" && req.method === "POST") {
            const res = await fetch(`${bridgeUrl}/qr-start`, {
                method: "POST",
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-qr-check") {
            const token = url.searchParams.get("token");
            const res = await fetch(`${bridgeUrl}/qr-check?token=${token}&secret=${env.BRIDGE_SECRET || "changeme"}`, {
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" }
            });
            return res;
        }

        if (url.pathname === "/admin/tg-test-msg" && req.method === "POST") {
            const res = await fetch(`${bridgeUrl}/test-tg`, {
                method: "POST",
                headers: { "x-bridge-secret": env.BRIDGE_SECRET || "changeme" },
                body: JSON.stringify({ message: "Admin test message!" })
            });
            return res;
        }


        if (url.pathname === "/admin/users-json") {
            const users = await fetchUsersWithStatus(env);
            return Response.json(users);
        }

        const users = await fetchUsersWithStatus(env);
        const checks: HealthChecks = {
            VERIFY_TOKEN: Boolean(env.VERIFY_TOKEN),
            META_PAGE_TOKEN: Boolean(env.META_PAGE_TOKEN),
            META_APP_SECRET: Boolean(env.META_APP_SECRET),
            WHATSAPP_TOKEN: Boolean(env.WHATSAPP_TOKEN),
            META_API_VERSION: Boolean(env.META_API_VERSION),
            WHATSAPP_PHONE_NUMBER_ID: Boolean(env.WHATSAPP_PHONE_NUMBER_ID),
            TELEGRAM_APP_ID: Boolean(env.TELEGRAM_APP_ID),
            TELEGRAM_APP_HASH: Boolean(env.TELEGRAM_APP_HASH),
            AUDIO_QUEUE: Boolean(env.AUDIO_QUEUE),
            AI: Boolean(env.AI),
        };

        const platforms = ["messenger", "instagram", "whatsapp", "telegram", "line"];
        const stats: any = {};
        for (const p of platforms) {
            const val = await env.STATS.get(`stats_${p}`);
            stats[p] = parseInt(val || "0", 10);
        }

        const errors = await getErrors(env);

        if (url.pathname === "/admin/whisper-config") {
            if (req.method === "GET") {
                let provider = await env.STATS.get("config_whisper_provider");
                // Only qwen3-asr is supported; fallback if old value
                if (!provider || provider !== 'qwen3-asr') {
                    provider = 'qwen3-asr';
                }
                const model = await env.STATS.get("config_ollama_model") || "qwen3-coder:30b";
                // Legacy fields (unused)
                const localUrl = await env.STATS.get("config_local_whisper_url") || "";
                const localSecret = await env.STATS.get("config_local_whisper_secret") || "";
                const ollamaUrl = await env.STATS.get("config_ollama_url") || "";
                return Response.json({ provider, model, localUrl, localSecret, ollamaUrl });
            }
            if (req.method === "POST") {
                const { provider, model, localUrl, localSecret, ollamaUrl } = await req.json() as any;
                // Only allow qwen3-asr provider
                if (provider === 'qwen3-asr') {
                    await env.STATS.put("config_whisper_provider", provider);
                }
                if (model) await env.STATS.put("config_ollama_model", model);
                // Ignore legacy fields
                return Response.json({ success: true });
            }
        }

        if (url.pathname === "/admin/ollama-pull" && req.method === "POST") {
            const { url: ollamaUrl, model } = await req.json() as any;
            if (!ollamaUrl || !model) return Response.json({ success: false, error: "Missing url or model" }, { status: 400 });
            // Direct fetch to ollama as we are in K8s
            try {
                await fetch(`${ollamaUrl}/api/pull`, {
                    method: "POST",
                    body: JSON.stringify({ name: model, stream: false })
                });
                return Response.json({ success: true });
            } catch (e: any) {
                return Response.json({ success: false, error: e.message }, { status: 500 });
            }
        }

        if (url.pathname === "/admin/user-action" && req.method === "POST") {
            const { userId, action } = await req.json() as any;
            if (action === "delete") {
                await env.STATS.delete(`user_meta_${userId}`);
                await env.STATS.delete(`tg_session_${userId}`);
                const listRaw = await env.STATS.get("users_list") || "[]";
                const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
                await env.STATS.put("users_list", JSON.stringify(list));
            }
            return Response.json({ success: true });
        }

        return new Response(renderAdminDashboard(checks, env, url.origin, stats, errors, users, false), {
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    } catch (e: any) {
        console.error("CRITICAL ADMIN ERROR:", e);
        return new Response(`<h1>Admin Rendering Error</h1><p>${e.message}</p><pre>${e.stack}</pre>`, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
}
