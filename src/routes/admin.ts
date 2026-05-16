import { Env } from "../types";
import { verifySession } from "../session";
import { logError } from "../logger";
import {
    adminLogin,
    adminLogout,
    showAdminLogin,
    getSampleAudio,
    getTgStatus,
    tgSendCode,
    tgVerifyCode,
    tgQrLogin,
    tgQrCheck,
    tgTestMsg,
    getUsersJson,
    getWhisperConfig,
    updateWhisperConfig,
    userAction,
    runDiagnostics,
    renderDashboardPage
} from "../controllers/adminController";

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const method = req.method;
        let pathname = url.pathname;
        if (pathname !== "/" && pathname.endsWith("/")) {
            pathname = pathname.slice(0, -1);
        }

        const cookieAuth = req.headers.get("Cookie")?.match(/admin_session=([^;]+)/)?.[1];
        const adminId = cookieAuth ? await verifySession(cookieAuth, env.ADMIN_SECRET) : null;

        if (method === "POST" && pathname === "/admin/login") {
            return await adminLogin(env, req);
        }

        if (pathname === "/admin/logout") {
            return await adminLogout();
        }

        if (adminId !== "admin") {
            if (method === "POST" || pathname.endsWith(".json") || pathname.includes("/tg-") || pathname.includes("/user-action")) {
                return new Response(JSON.stringify({ success: false, error: "Unauthorized. Please login." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return showAdminLogin();
        }

        if (method === "POST") {
            const origin = req.headers.get("Origin");
            const host = url.hostname;
            if (origin && !origin.includes(host)) {
                await logError("admin", `Potential CSRF block: Origin=${origin} Host=${host}`, env);
            }
        }

        if (pathname === "/admin/js") {
            return new Response("console.warn('/admin/js is deprecated. Use /assets/js/admin.js');", { headers: { "Content-Type": "application/javascript" } });
        }

        if (method === "GET" && pathname === "/admin/sample-audio") {
            return await getSampleAudio();
        }

        if (method === "GET" && pathname === "/admin/tg-status") {
            return await getTgStatus(env);
        }

        // All Telegram auth (QR, phone code, etc.) moved to pure tdweb in browser.
        // Only tg-client-manager orchestration remains.

        if (method === "POST" && pathname === "/admin/tg-test-msg") {
            return await tgTestMsg(env, req);
        }

        if (method === "GET" && pathname === "/admin/users-json") {
            return await getUsersJson(env);
        }

        if (pathname === "/admin/whisper-config") {
            if (method === "GET") return await getWhisperConfig(env);
            if (method === "POST") return await updateWhisperConfig(env, req);
        }


        if (method === "POST" && pathname === "/admin/user-action") {
            return await userAction(env, req);
        }

        if (method === "POST" && pathname === "/admin/run-diagnostics") {
            return await runDiagnostics(env);
        }

        if (method === "GET" && pathname === "/admin") {
            return await renderDashboardPage(env, url.origin);
        }

        return new Response("Not found", { status: 404 });
    } catch (e: any) {
        console.error("CRITICAL ADMIN ERROR:", e);
        return new Response(`<h1>Admin Rendering Error</h1><p>${e.message}</p><pre>${e.stack}</pre>`, {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" }
        });
    }
}
