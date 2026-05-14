import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { readFileSync } from "fs";
import { serveStatic } from "@hono/node-server/serve-static";
import { Env } from "./types";
import worker from "./index";
import { RedisKV } from "./redisKV";
import "dotenv/config";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

// Serve favicon directly from filesystem (no bridge proxy needed)
const FAVICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0F172A"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0B1220"/>
  <rect x="14" y="14" width="10" height="20" rx="5" fill="url(#g)"/>
  <path d="M10 30 Q19 40 28 30" stroke="url(#g)" stroke-width="3" fill="none"/>
  <path d="M28 28 Q34 18 38 28 T48 28" stroke="url(#g)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
</svg>`;

app.get("/favicon.svg", (c) => {
  return c.body(FAVICON_SVG, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400"
  });
});

app.get("/favicon.ico", (c) => {
  return c.body(FAVICON_SVG, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=86400"
  });
});

// Serve static assets from src/ui using Hono's built-in static server
app.use("/assets/*", serveStatic({ 
  root: "./",
  rewriteRequestPath: (path) => path.replace(/^\/assets/, "/src/ui")
}));

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
    STATS: new RedisKV(process.env.REDIS_URL),
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
  port,
  hostname: "0.0.0.0"
});
