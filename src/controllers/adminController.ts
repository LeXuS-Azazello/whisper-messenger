import { Env, UserSession, HealthChecks } from "../types";
import { getErrors, logError } from "../logger";
import { renderAdminDashboard } from "../components/admin/AdminDashboard";
import { renderAdminLogin } from "../components/admin/AdminLogin";
import { createSignedSession } from "../session";
import { sampleAudioBase64 } from "../sample_audio";

export async function fetchUsersWithStatus(env: Env): Promise<UserSession[]> {
    const userIdsRaw = await env.STATS.get("users_list");
    let userIds: string[] = userIdsRaw ? JSON.parse(userIdsRaw) : [];

    if (userIds.length > 50) {
        userIds = userIds.slice(-50);
    }

    const users: UserSession[] = [];
    const userConfigs = await Promise.all(userIds.map(async (id) => {
        const metaStr = await env.STATS.get(`user_meta_${id}`);
        if (!metaStr) return null;
        try {
            const meta = JSON.parse(metaStr) as UserSession;
            const session = await env.STATS.get(`tg_session_${id}`);
            meta.tgAuthenticated = !!session;
            return meta;
        } catch (e) {
            return null;
        }
    }));

    userConfigs.forEach(u => { if (u) users.push(u); });

    try {
        const secret = (env.BRIDGE_SECRET || "changeme").trim();
        const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
        const podsRes = await fetch(`${bridgeUrl}/pods?secret=${secret}`, {
            headers: { "x-bridge-secret": secret }
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

export async function adminLogin(env: Env, req: Request): Promise<Response> {
    const formData = await req.formData();
    const password = formData.get("password")?.toString();
    if (password === env.ADMIN_SECRET) {
        const signedAdminSession = await createSignedSession("admin", env.ADMIN_SECRET);
        return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=${signedAdminSession}; Path=/; HttpOnly; SameSite=Lax;` } });
    }
    return new Response(renderAdminLogin("Invalid password"), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function adminLogout(): Promise<Response> {
    return new Response("Redirect", { status: 302, headers: { "Location": "/admin", "Set-Cookie": `admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` } });
}

export function showAdminLogin(): Response {
    return new Response(renderAdminLogin(), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function getSampleAudio(): Promise<Response> {
    return Response.json({ url: sampleAudioBase64 });
}

async function proxyToBridge(url: string, options: any): Promise<Response> {
    try {
        const res = await fetch(url, options);
        return res;
    } catch (e: any) {
        console.warn("[Admin] Bridge proxy failed:", e.message);
        return Response.json({ success: false, error: `Bridge unreachable: ${e.message}` }, { status: 503 });
    }
}

export async function getTgStatus(env: Env): Promise<Response> {
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    return await proxyToBridge(`${bridgeUrl}/health?secret=${secret}`, {
        headers: { "x-bridge-secret": secret }
    });
}

export async function tgSendCode(env: Env, req: Request): Promise<Response> {
    const { phoneNumber } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    return await proxyToBridge(`${bridgeUrl}/send-code?secret=${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
        body: JSON.stringify({ phone: phoneNumber })
    });
}

export async function tgVerifyCode(env: Env, req: Request): Promise<Response> {
    const { phoneNumber, code } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    return await proxyToBridge(`${bridgeUrl}/verify-code?secret=${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
        body: JSON.stringify({ phone: phoneNumber, code })
    });
}

export async function tgQrLogin(env: Env): Promise<Response> {
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    return await proxyToBridge(`${bridgeUrl}/qr-start?secret=${secret}`, {
        method: "POST",
        headers: { "x-bridge-secret": secret }
    });
}

export async function tgQrCheck(env: Env, token: string | null): Promise<Response> {
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    return await proxyToBridge(`${bridgeUrl}/qr-check?token=${token}&secret=${secret}`, {
        headers: { "x-bridge-secret": secret }
    });
}

export async function tgTestMsg(env: Env, req: Request): Promise<Response> {
    const { userId, message } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();
    
    // Get session for the user if userId is provided, otherwise it uses bridge's own
    let session = null;
    if (userId) {
        session = await env.STATS.get(`tg_session_${userId}`);
    }

    return await proxyToBridge(`${bridgeUrl}/test-tg?secret=${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
        body: JSON.stringify({ 
            userId, 
            session,
            message: message || "Admin test message!" 
        })
    });
}

export async function getUsersJson(env: Env): Promise<Response> {
    const users = await fetchUsersWithStatus(env);
    return Response.json(users);
}

export async function getWhisperConfig(env: Env): Promise<Response> {
    const provider = await env.STATS.get("config_whisper_provider") || env.WHISPER_PROVIDER || 'qwen3-asr';
    const localUrl = await env.STATS.get("config_local_whisper_url") || env.WHISPER_TURBO_URL || "";
    const localSecret = await env.STATS.get("config_local_whisper_secret") || env.LOCAL_WHISPER_SECRET || "";
    const ollamaUrl = await env.STATS.get("config_ollama_url") || env.OLLAMA_BASE_URL || "";
    const model = await env.STATS.get("config_whisper_model") || "";
    
    // Attempt to sync from DB if Redis is empty but we want to be sure it's consistent
    // In a real scenario, we might want to load from DB on startup and populate Redis.
    
    return Response.json({ provider, localUrl, localSecret, ollamaUrl, model });
}

export async function updateWhisperConfig(env: Env, req: Request): Promise<Response> {
    const { provider, localUrl, localSecret, ollamaUrl, model } = await req.json() as any;
    const { default: ServerSetting } = await import("../models/ServerSetting");
    
    const settings = [
        { key: "config_whisper_provider", value: provider },
        { key: "config_local_whisper_url", value: localUrl },
        { key: "config_local_whisper_secret", value: localSecret },
        { key: "config_ollama_url", value: ollamaUrl },
        { key: "config_whisper_model", value: model }
    ];

    for (const s of settings) {
        if (s.value !== undefined && s.value !== null) {
            // Save to Redis (for fast access in workers/bridge)
            await env.STATS.put(s.key, String(s.value));
            
            // Save to MongoDB (for persistence)
            await ServerSetting.findOneAndUpdate(
                { key: s.key },
                { value: s.value, category: 'whisper' },
                { upsert: true, new: true }
            );
        }
    }
    
    return Response.json({ success: true });
}

export async function userAction(env: Env, req: Request): Promise<Response> {
    const { userId, action } = await req.json() as any;
    const bridgeUrl = (env.BRIDGE_URL || "http://mtproto-bridge-manager:3000").replace(/\/$/, '');
    const secret = (env.BRIDGE_SECRET || "changeme").trim();

    if (action === "restart") {
        const session = await env.STATS.get(`tg_session_${userId}`);
        // First delete
        await proxyToBridge(`${bridgeUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
            body: JSON.stringify({ userId })
        }).catch(() => {});
        
        if (session) {
            // Then spawn
            return await proxyToBridge(`${bridgeUrl}/spawn?secret=${secret}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
                body: JSON.stringify({ userId, session })
            });
        }
    } else if (action === "stop") {
        return await proxyToBridge(`${bridgeUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
            body: JSON.stringify({ userId })
        });
    } else if (action === "delete") {
        await env.STATS.delete(`user_meta_${userId}`);
        await env.STATS.delete(`tg_session_${userId}`);
        const listRaw = await env.STATS.get("users_list") || "[]";
        const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
        await env.STATS.put("users_list", JSON.stringify(list));
        
        // Also delete pod
        await fetch(`${bridgeUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-bridge-secret": secret },
            body: JSON.stringify({ userId })
        }).catch(() => {});
    }
    return Response.json({ success: true });
}

export async function renderDashboardPage(env: Env, origin: string): Promise<Response> {
    const users = await fetchUsersWithStatus(env);
    const provider = await env.STATS.get("config_whisper_provider") || env.WHISPER_PROVIDER || 'qwen3-asr';
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
        // Custom fields for UI state
        ...({
            WHISPER_PROVIDER: provider,
            WHISPER_PROVIDER_NAME: provider.replace('-', ' ').toUpperCase()
        } as any)
    };

    const platforms = ["messenger", "instagram", "whatsapp", "telegram", "line"];
    const stats: any = {};
    for (const p of platforms) {
        const val = await env.STATS.get(`stats_${p}`);
        stats[p] = parseInt(val || "0", 10);
    }

    const errors = await getErrors(env);

    return new Response(renderAdminDashboard(checks, env, origin, stats, errors, users, false), {
        headers: { "Content-Type": "text/html; charset=utf-8" }
    });
}

export async function syncSettingsToRedis(env: Env) {
    console.log("[Settings] Syncing settings from MongoDB to Redis...");
    try {
        const { default: ServerSetting } = await import("../models/ServerSetting");
        const settings = await ServerSetting.find({ category: 'whisper' });
        
        for (const s of settings) {
            console.log(`[Settings] Syncing ${s.key} -> ${s.value}`);
            await env.STATS.put(s.key, String(s.value));
        }
        console.log("[Settings] Sync complete.");
    } catch (e) {
        console.error("[Settings] Sync failed:", e);
    }
}
