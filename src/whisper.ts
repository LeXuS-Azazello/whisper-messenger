import { Env } from "./types";

export interface TranscriptionResult {
  text: string;
  detectedLanguage: string;
  translated?: string | null;
  targetLanguage?: string | null;
  model?: string;
}

/**
 * Calls whisper-service-v2 with auto language detection + optional translation.
 * This is the recommended function for all messengers.
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  env: Env,
  targetLanguage?: string | null
): Promise<TranscriptionResult> {
  const url = await env.STATS.get("config_local_whisper_url") 
    || env.WHISPER_PROVIDER 
    || "http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000";

  if (!url) throw new Error("Whisper Turbo URL not configured");

  const base64Data = Buffer.from(audio).toString('base64');

  const payload: any = {
    file_data: base64Data,
    language: "auto"
  };

  if (targetLanguage) {
    payload.target_language = targetLanguage;
  }

  const secret = env.WHISPER_SECRET || "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000);

  try {
    const response = await fetch(`${url}/v1/transcribe-base64`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`whisper-service error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;

    let text = result.text || result.transcription || "";

    // Hallucination cleanup
    text = text.replace(/(.+?\.)\s*\1\s*\1(\s*\1)*/g, '$1 $1');

    return {
      text,
      detectedLanguage: result.language || result.detected_language || "unknown",
      translated: result.translated || null,
      targetLanguage: result.target_language || targetLanguage || null,
      model: "whisper-service-v2"
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Legacy wrapper for backward compatibility */
export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env,
  providerOverride?: string
): Promise<{ text: string; model?: string }> {
  const res = await transcribeAudio(audio, env);
  return { text: res.text, model: res.model };
}