import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { readFileSync } from "fs";
import { Env } from "./types";
import worker from "./index";
import "dotenv/config";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Serve favicon directly from filesystem (no bridge proxy needed)
app.get("/favicon.svg", async (_c) => {
  try {
    const faviconPath = new URL("./favicon.svg", import.meta.url);
    const data = readFileSync(faviconPath);
    return new Response(data, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" }
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
});

// Mock ExecutionContext for Hono
const createCtx = () => ({
  waitUntil: (promise: Promise<any>) => {
    promise.catch(err => console.error("Error in waitUntil:", err));
  },
  passThroughOnException: () => {},
}) as any;

app.all("*", async (c) => {
  const env: Env = {
    ...((typeof process !== 'undefined' ? process.env : {}) as any),
    AI: undefined, // Cloudflare AI not available in Node.js, will use local fallback
  } as any;

  // Convert Hono request to Web Standard Request
  const req = c.req.raw;

  // Call the existing worker fetch handler
  const res = await worker.fetch(req, env, createCtx());

  return res;
});

const port = Number(process.env.PORT) || 3000;
console.log(`Frontend server starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port
});
