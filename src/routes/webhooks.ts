import { Env, MetaWebhookBody, WhatsAppWebhookBody } from "../types";
import { TelegramWebhookUpdate } from "../telegram";
import {
  processTelegramWebhook,
  processMetaMessagingWebhook,
  processWhatsAppWebhook,
  processLineWebhook
} from "../controllers/webhookController";

export async function handleTelegram(update: TelegramWebhookUpdate, env: Env): Promise<Response> {
  return await processTelegramWebhook(update, env);
}

export async function handleMetaMessaging(body: MetaWebhookBody, env: Env): Promise<Response> {
  return await processMetaMessagingWebhook(body, env);
}

export async function handleWhatsApp(body: WhatsAppWebhookBody, env: Env): Promise<Response> {
  return await processWhatsAppWebhook(body, env);
}

export async function handleLine(body: any, userId: string, env: Env): Promise<Response> {
  return await processLineWebhook(body, userId, env);
}
