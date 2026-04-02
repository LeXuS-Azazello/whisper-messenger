import { Env } from "./types";

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
    errors = errors.slice(0, 10); // Keep last 10 errors
    await env.STATS.put("last_errors", JSON.stringify(errors));
  } catch (err) {
    console.error(`Failed to log error: ${err}`);
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
