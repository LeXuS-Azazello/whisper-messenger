import { Env, UserSession, HealthChecks, DiagnosticResults } from "../types";
import { getErrors, logError } from "../logger";
import { renderAdminDashboard } from "../components/admin/AdminDashboard";
import { renderAdminLogin } from "../components/admin/AdminLogin";
import { createSignedSession } from "../session";
import { sampleAudioBase64 } from "../sample_audio";
import mongoose from "mongoose";
import path from "path";
import User from "../models/User";

export async function runDiagnostics(env: Env): Promise<Response> {
    const results: DiagnosticResults = {
        redis: { status: 'unknown', message: '' },
        mongodb: { status: 'unknown', message: '' },
        manager: { status: 'unknown', message: '' },
        asr: { status: 'unknown', message: '' },
        k8s: { status: 'unknown', message: '' }
    };

    // 1. Test Redis
    try {
        const start = Date.now();
        await env.STATS.put("diag_test", "ok", { expirationTtl: 10 });
        const val = await env.STATS.get("diag_test");
        const lat = Date.now() - start;
        if (val === "ok") {
            results.redis = { status: 'healthy', message: `Connected (Latency: ${lat}ms)` };
        } else {
            results.redis = { status: 'unhealthy', message: 'Read/Write mismatch' };
        }
    } catch (e: any) {
        results.redis = { status: 'error', message: e.message };
    }

    // 2. Test MongoDB
    try {
        const state = mongoose.connection.readyState;
        const states = ["disconnected", "connected", "connecting", "disconnecting"];
        if (state === 1 && mongoose.connection.db) {
            const count = await mongoose.connection.db.collection('users').countDocuments();
            results.mongodb = { status: 'healthy', message: `Connected (${count} users in DB)` };
        } else if (state === 1) {
            results.mongodb = { status: 'healthy', message: `Connected (DB object initializing)` };
        } else {
            results.mongodb = { status: 'unhealthy', message: `State: ${states[state] || state}` };
        }
    } catch (e: any) {
        results.mongodb = { status: 'error', message: e.message };
    }

    // 3. Test Manager (tg-client-manager)
    try {
        const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
        const secret = (env.MANAGER_SECRET || "changeme").trim();
        const start = Date.now();
        const res = await fetch(`${managerUrl}/health?secret=${secret}`, {
            headers: { "x-manager-secret": secret },
            signal: AbortSignal.timeout(5000)
        });
        const lat = Date.now() - start;
        if (res.ok) {
            const data = await res.json() as any;
            results.manager = { status: 'healthy', message: `Connected (${data.mode}, Latency: ${lat}ms)` };
            if (data.k8s) {
                results.k8s = { status: 'healthy', message: 'K8s API Accessible' };
            } else {
                results.k8s = { status: 'unhealthy', message: 'K8s API Access Failed (Check SA permissions)' };
            }
        } else {
            results.manager = { status: 'unhealthy', message: `HTTP ${res.status}: ${await res.text()}` };
        }
    } catch (e: any) {
        results.manager = { status: 'error', message: `Fetch failed: ${e.message}. Is MANAGER_URL correct?` };
    }

    // 4. Test ASR
    try {
        const asrUrl = await env.STATS.get("config_local_whisper_url") || env.WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';

        const start = Date.now();
        const res = await fetch(`${asrUrl}/v1/models`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
        const lat = Date.now() - start;

        if (res && res.ok) {
            results.asr = { status: 'healthy', message: `whisper-service active (Latency: ${lat}ms)` };
        } else {
            // Try simple ping
            const ping = await fetch(asrUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) }).catch(() => null);
            if (ping) {
                results.asr = { status: 'healthy', message: `whisper-service reachable (No /v1/models, Latency: ${lat}ms)` };
            } else {
                results.asr = { status: 'unhealthy', message: `whisper-service at ${asrUrl} is unreachable` };
            }
        }
    } catch (e: any) {
        results.asr = { status: 'error', message: e.message };
    }

    return Response.json(results);
}

export async function fetchUsersWithStatus(env: Env): Promise<UserSession[]> {
    try {
        // 1. Fetch all users from MongoDB
        const dbUsers = await User.find({}).lean();
        
        // 2. Fetch active pods from tg-client-manager with a safe timeout (5s)
        let activePods: any[] = [];
        try {
            const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
            const secret = (env.MANAGER_SECRET || "changeme").trim();
            const res = await fetch(`${managerUrl}/pods?secret=${secret}`, {
                headers: { "x-manager-secret": secret },
                signal: AbortSignal.timeout(5000)
            });
            if (res.ok) {
                activePods = await res.json() as any[];
            }
        } catch (e: any) {
            console.warn("[Admin] Failed to fetch active pods from manager:", e.message);
        }

        const podsMap = new Map<string, any>();
        activePods.forEach(p => {
            if (p.userId) podsMap.set(String(p.userId), p);
        });

        const users: UserSession[] = [];
        for (const dbUser of dbUsers) {
            const userId = dbUser.userId;
            
            // Check if user has an active Telegram session in Redis
            const session = await env.STATS.get(`tg_session_${userId}`);
            
            // Get user meta (firstName, username, etc.) from Redis or fall back to DB
            const metaStr = await env.STATS.get(`user_meta_${userId}`);
            let meta: Partial<UserSession> = {};
            if (metaStr) {
                try { meta = JSON.parse(metaStr); } catch (e) {}
            }

            const podInfo = podsMap.get(String(userId));
            const isActive = !!podInfo;
            
            users.push({
                userId,
                firstName: meta.firstName || dbUser.firstName || "Telegram User",
                username: meta.username || dbUser.username || "",
                phone: meta.phone || "",
                session: session || "",
                platform: "telegram",
                createdAt: dbUser.createdAt ? new Date(dbUser.createdAt).getTime() : Date.now(),
                tgAuthenticated: !!session,
                isActive,
                currentStatus: podInfo ? podInfo.status : "STOPPED",
                podName: podInfo ? podInfo.podName : undefined,
                lastStartedAt: podInfo && podInfo.startTime ? new Date(podInfo.startTime).getTime() : undefined,
                transcriptionCount: dbUser.transcriptionCount || 0,
                lastActiveAt: dbUser.lastActiveAt ? dbUser.lastActiveAt.getTime() : undefined
            });
        }
        
        return users;
    } catch (err: any) {
        console.error("[Admin] fetchUsersWithStatus error:", err);
        return [];
    }
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

async function proxyToManager(url: string, options: any): Promise<Response> {
    try {
        const res = await fetch(url, options);
        // Create a new Response object with mutable headers to avoid "TypeError: immutable"
        // when Hono/middlewares (such as CORS or logs) try to mutate the response headers.
        const headers = new Headers(res.headers);
        return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers
        });
    } catch (e: any) {
        console.warn("[Admin] Manager proxy failed:", e.message);
        return Response.json({ success: false, error: `Manager unreachable: ${e.message}` }, { status: 503 });
    }
}

export async function getTgStatus(env: Env): Promise<Response> {
    const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
    const secret = (env.MANAGER_SECRET || "changeme").trim();
    return await proxyToManager(`${managerUrl}/health?secret=${secret}`, {
        headers: { "x-manager-secret": secret }
    });
}

// All old Telegram phone/QR proxy functions removed.
// Telegram auth is now 100% client-side via tdweb (TdClient).

export async function tgTestMsg(env: Env, req: Request): Promise<Response> {
    const { userId, message } = await req.json() as any;
    const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
    const secret = (env.MANAGER_SECRET || "changeme").trim();

    // Get session for the user if userId is provided, otherwise it uses manager's own
    let session = null;
    if (userId) {
        session = await env.STATS.get(`tg_session_${userId}`);
    }

    return await proxyToManager(`${managerUrl}/test-tg?secret=${secret}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-manager-secret": secret },
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
    const provider = env.WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';
    const localSecret = env.WHISPER_SECRET || "";

    return Response.json({ provider, localSecret });
}

export async function updateWhisperConfig(env: Env, req: Request): Promise<Response> {
    const { provider, localSecret } = await req.json() as any;
    const { default: ServerSetting } = await import("../models/ServerSetting");

    const settings = [
        { key: "config_whisper_provider", value: provider },
        { key: "config_local_whisper_secret", value: localSecret }
    ];

    for (const s of settings) {
        if (s.value !== undefined && s.value !== null) {
            // Save to Redis (for fast access in workers/manager)
            await env.STATS.put(s.key, String(s.value));

            // Save to MongoDB (for persistence)
            await ServerSetting.findOneAndUpdate(
                { key: s.key },
                { key: s.key, value: String(s.value) },
                { upsert: true }
            );
        }
    }

    return Response.json({ success: true });
}

export async function handleGetPodLogs(env: Env, podName: string): Promise<Response> {
    const managerUrl = (env.MANAGER_URL || "http://tg-client-manager:3000").replace(/\/$/, '');
    const secret = (env.MANAGER_SECRET || "changeme").trim();

    try {
        const res = await fetch(`${managerUrl}/internal/logs/${podName}?secret=${secret}`, {
            headers: { "x-manager-secret": secret }
        });
        const text = await res.text();
        return new Response(text, { headers: { "Content-Type": "text/plain" } });
    } catch (e: any) {
        return new Response(`Failed to fetch logs: ${e.message}`, { status: 500 });
    }
}

export async function userAction(env: Env, req: Request): Promise<Response> {
    const { userId, action } = await req.json() as any;
    const managerUrl = (env.MANAGER_URL || `http://tg-client-manager.${env.NAMESPACE}.svc.cluster.local:3000`).replace(/\/$/, '');
    const secret = (env.MANAGER_SECRET || "changeme").trim();

    if (action === "restart") {
        const session = await env.STATS.get(`tg_session_${userId}`);
        // First delete
        await proxyToManager(`${managerUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-manager-secret": secret },
            body: JSON.stringify({ userId })
        }).catch(() => { });

        if (session) {
            // Then spawn
            return await proxyToManager(`${managerUrl}/spawn?secret=${secret}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-manager-secret": secret },
                body: JSON.stringify({ userId })
            });
        }
    } else if (action === "stop") {
        return await proxyToManager(`${managerUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-manager-secret": secret },
            body: JSON.stringify({ userId })
        });
    } else if (action === "delete") {
        // Delete user from MongoDB persistence
        await User.deleteOne({ userId });

        await env.STATS.delete(`user_meta_${userId}`);
        await env.STATS.delete(`tg_session_${userId}`);
        const listRaw = await env.STATS.get("users_list") || "[]";
        const list = JSON.parse(listRaw).filter((id: string) => id !== userId);
        await env.STATS.put("users_list", JSON.stringify(list));

        // Also delete pod
        await fetch(`${managerUrl}/delete?secret=${secret}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-manager-secret": secret },
            body: JSON.stringify({ userId })
        }).catch(() => { });
    }
    return Response.json({ success: true });
}

export async function renderDashboardPage(env: Env, origin: string): Promise<Response> {
    const users = await fetchUsersWithStatus(env);
    const provider = env.WHISPER_PROVIDER || 'http://whisper-service.debugging-testcrash-pub.svc.cluster.local:8000';
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
