import { Env, MetaWebhookBody, WhatsAppWebhookBody } from "../types";
import { TelegramWebhookUpdate } from "../telegram";
import { processTelegramWebhook } from "../controllers/webhookController";

export async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  return await processTelegramWebhook(update, env);
}

// Placeholder handlers - to be implemented when Meta/Instagram (Threads) and Line are needed
export async function handleMetaMessaging(_body: MetaWebhookBody, _env: Env): Promise<Response> {
  return new Response("Not implemented", { status: 501 });
}

export async function handleWhatsApp(_body: WhatsAppWebhookBody, _env: Env): Promise<Response> {
  return new Response("Not implemented", { status: 501 });
}

export async function handleLine(_body: any, _userId: string, _env: Env): Promise<Response> {
  return new Response("Not implemented", { status: 501 });
}