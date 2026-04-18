import { Env } from "./types";
import { sendTelegramMessage } from "./telegram";

export interface ErrorLog {
  timestamp: string;
  platform: string;
  message: string;
}

export async function logError(platform: string, error: string, env: Env) {
  try {
    const errorLog = await env.STATS.get("last_errors");
    let errors: ErrorLog[] = errorLog ? JSON.parse(errorLog) : [];
    const newError = {
      timestamp: new Date().toISOString(),
      platform,
      message: error,
    };
    errors.unshift(newError);
    errors = errors.slice(0, 50);
    await env.STATS.put("last_errors", JSON.stringify(errors));

    // Notify admin if Chat ID is configured
    if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_BOT_TOKEN) {
      await sendTelegramMessage(env.TELEGRAM_CHAT_ID, `🚨 <b>Error [${platform}]</b>\n<pre>${error}</pre>`, env).catch(() => {});
    }
  } catch (err) {
    console.error(`Failed to log error: ${err}`);
  }
}

export async function logInfo(platform: string, message: string, env: Env) {
  try {
    const errorLog = await env.STATS.get("last_errors");
    let errors: ErrorLog[] = errorLog ? JSON.parse(errorLog) : [];
    const newError = {
      timestamp: new Date().toISOString(),
      platform,
      message: `[INFO] ${message}`,
    };
    errors.unshift(newError);
    errors = errors.slice(0, 50);
    await env.STATS.put("last_errors", JSON.stringify(errors));

    // Notify admin about critical info (like new user sessions)
    if (env.TELEGRAM_CHAT_ID && env.TELEGRAM_BOT_TOKEN && (message.toLowerCase().includes("new session") || message.toLowerCase().includes("bridge started"))) {
        await sendTelegramMessage(env.TELEGRAM_CHAT_ID, `ℹ️ <b>Info [${platform}]</b>\n${message}`, env).catch(() => {});
    }
  } catch (err) {
    console.error(`Failed to log info: ${err}`);
  }
}

export async function getErrors(env: Env): Promise<ErrorLog[]> {
  try {
    const val = await env.STATS.get("last_errors");
    return val ? JSON.parse(val) : [];
  } catch (err) {
    return [];
  }
}
