import { Env } from "./types";

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      type: "private" | "group" | "supergroup" | "channel";
    };
    voice?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      mime_type?: string;
      file_size?: number;
      title?: string;
      performer?: string;
    };
    video_note?: {
      file_id: string;
      file_unique_id: string;
      duration: number;
      length: number;
    };
    video?: {
      file_id: string;
      file_unique_id: string;
      width: number;
      height: number;
      duration: number;
      mime_type?: string;
      file_size?: number;
    };
  };
}

export async function sendTelegramMessage(chatId: string | number, text: string, env: Env, replyToMsgId?: number): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body: any = {
    chat_id: chatId,
    text: text,
  };
  if (replyToMsgId) {
    body.reply_to_message_id = replyToMsgId;
  }
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[telegram] Failed to send message to ${chatId}: ${err}`);
  }
}

export async function sendTelegramTypingOn(chatId: string | number, env: Env): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendChatAction`;
  await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: "typing",
    }),
  });
}

export async function getTelegramFileUrl(fileId: string, env: Env): Promise<string | null> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    console.error(`[telegram] getFile failed: ${await res.text()}`);
    return null;
  }

  const data = (await res.json()) as { ok: boolean; result: { file_path: string } };
  if (!data.ok || !data.result?.file_path) {
    console.error(`[telegram] getFile response not ok: ${JSON.stringify(data)}`);
    return null;
  }

  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}
