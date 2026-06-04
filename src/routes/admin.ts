import { Env } from "../types";
import { verifySession } from "../session";
import { logError } from "../logger";
import {
    adminLogin,
    adminLogout,
    showAdminLogin,
    getSampleAudio,
    getTgStatus,
    tgTestMsg,
    getUsersJson,
    getAiConfig,
    updateAiConfig,
    userAction,
    runDiagnostics,
    renderDashboardPage,
    switchAsrModel
} from "../controllers/adminController";

export async function handleAdmin(env: Env, req: Request): Promise<Response> {
    try {
        const url = new URL(req.url);
        const method = req.method;
        let pathname = url.pathname;
        if (pathname !== "/" && pathname.endsWith("/")) {
            pathname = pathname.slice(0, -1);
        }

        const cookieAuth = req.headers.get("Cookie")?.match(/(?:^|;)\s*admin_session=([^;]+)/)?.[1];
        const adminId = cookieAuth ? await verifySession(cookieAuth, env.ADMIN_SECRET) : null;

        if (method === "POST" && pathname === "/admin/login") {
            return await adminLogin(env, req);
        }

        if (pathname === "/admin/logout") {
            return await adminLogout();
        }

        if (adminId !== "admin") {
            if (method === "POST" || pathname.endsWith(".json") || pathname.includes("/tg-") || pathname.includes("/user-action") || pathname.includes("/admin/tester") || pathname.includes("/admin/mongo") || pathname.includes("/admin/run-asr-test")) {
                return new Response(JSON.stringify({ success: false, error: "Unauthorized. Please login." }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" }
                });
            }
            return showAdminLogin();
        }

        // Secure internal reverse proxy for voicemsg-tester diagnostics dashboard and API
        if (pathname === "/admin/tester" || pathname.startsWith("/admin/tester/")) {
            const namespace = env.NAMESPACE || "debugging-testcrash-pub";
            const testerUrl = `http://voicemsg-tester:3000`;
            const proxyPath = pathname.replace(/^\/admin\/tester/, "") || "/";
            const targetUrl = `${testerUrl}${proxyPath}${url.search}`;
            
            console.log(`[Admin Proxy] Forwarding admin diagnostics request to: ${targetUrl}`);
            
            try {
                const forwardHeaders = new Headers();
                req.headers.forEach((value, key) => {
                    if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'keep-alive') {
                        forwardHeaders.set(key, value);
                    }
                });
                
                const hasBody = req.method !== "GET" && req.method !== "HEAD" && (
                    (req.headers.get("content-length") && req.headers.get("content-length") !== "0") ||
                    req.headers.get("transfer-encoding")
                );
                
                const proxyReq = new Request(targetUrl, {
                    method: req.method,
                    headers: forwardHeaders,
                    body: hasBody ? await req.blob() : undefined,
                    redirect: "manual"
                });
                
                const res = await fetch(proxyReq);
                
                const responseHeaders = new Headers();
                res.headers.forEach((value, key) => {
                    responseHeaders.set(key, value);
                });
                
                return new Response(res.body, {
                    status: res.status,
                    statusText: res.statusText,
                    headers: responseHeaders
                });
            } catch (err: any) {
                console.error(`[Admin Proxy] Failed to fetch downstream tester service:`, err);
                return new Response(`<h1>Tester Proxy Error</h1><p>Failed to contact the downstream tester service at <code>${targetUrl}</code>.</p><p>Error: ${err.message || String(err)}</p>`, {
                    status: 502,
                    headers: { "Content-Type": "text/html" }
                });
            }
        }

        // Secure internal reverse proxy for mongo-express UI and API
        if (pathname === "/admin/mongo" || pathname.startsWith("/admin/mongo/")) {
            // Standardize path: mongo-express expects basePath to have a trailing slash
            if (url.pathname === "/admin/mongo") {
                return Response.redirect(`${url.origin}/admin/mongo/`, 301);
            }

            const namespace = env.NAMESPACE || "debugging-testcrash-pub";
            const mongoExpressUrl = `http://mongo-express:8081`;
            // Keep the full pathname because ME_CONFIG_SITE_BASEURL is set to "/admin/mongo/"
            const targetUrl = `${mongoExpressUrl}${url.pathname}${url.search}`;

            console.log(`[Admin Proxy] Forwarding admin MongoDB request to: ${targetUrl}`);

            try {
                // Determine headers to forward.
                const forwardHeaders = new Headers();
                req.headers.forEach((value, key) => {
                    if (key.toLowerCase() !== 'connection' && key.toLowerCase() !== 'keep-alive') {
                        forwardHeaders.set(key, value);
                    }
                });

                const hasBody = req.method !== "GET" && req.method !== "HEAD" && (
                    (req.headers.get("content-length") && req.headers.get("content-length") !== "0") ||
                    req.headers.get("transfer-encoding")
                );
                
                const proxyReq = new Request(targetUrl, {
                    method: req.method,
                    headers: forwardHeaders,
                    body: hasBody ? await req.blob() : undefined,
                    redirect: "manual"
                });

                const res = await fetch(proxyReq);

                // Copy headers from downstream response
                const responseHeaders = new Headers();
                res.headers.forEach((value, key) => {
                    responseHeaders.set(key, value);
                });

                return new Response(res.body, {
                    status: res.status,
                    statusText: res.statusText,
                    headers: responseHeaders
                });
            } catch (err: any) {
                console.error(`[Admin Proxy] Failed to fetch downstream mongo-express service:`, err);
                return new Response(`<h1>Mongo Express Proxy Error</h1><p>Failed to contact the downstream mongo-express service at <code>${targetUrl}</code>.</p><p>Error: ${err.message || String(err)}</p>`, {
                    status: 502,
                    headers: { "Content-Type": "text/html" }
                });
            }
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

        if (pathname === "/admin/ai-config") {
            if (method === "GET") return await getAiConfig(env);
            if (method === "POST") return await updateAiConfig(env, req);
        }


        if (method === "POST" && pathname === "/admin/user-action") {
            return await userAction(env, req);
        }

        if (method === "POST" && pathname === "/admin/run-diagnostics") { return await runDiagnostics(env); }

        if (method === "GET" && pathname === "/admin") {
            return await renderDashboardPage(env, url.origin);
        }

        if (method === "POST" && pathname === "/admin/asr-switch") {
            return await switchAsrModel(env, req);
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
