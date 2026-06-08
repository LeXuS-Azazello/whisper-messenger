import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { connectDB } from "../src/db/mongoose";
import { processTelegramWebhook } from "../src/controllers/webhookController";
import "dotenv/config";

// Connect to MongoDB using the shared connection logic
connectDB();

const app = new Hono();

app.post("/webhooks/telegram", async (c) => {
    // Construct environment object
    const env = {
        ...((typeof process !== 'undefined' ? process.env : {}) as any)
    };

    try {
        const body = await c.req.json();
        await processTelegramWebhook(body, env);
        return c.text("OK", 200);
    } catch (e) {
        console.error("[telegram-bot] Webhook processing error:", e);
        return c.text("Error", 500);
    }
});

const port = Number(process.env.PORT) || 3001;
console.log(`🤖 [TelegramBot] Webhook server starting on port ${port}...`);

serve({
    fetch: app.fetch,
    port,
    hostname: "0.0.0.0"
});
