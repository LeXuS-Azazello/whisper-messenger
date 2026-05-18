import { Env } from "./types";

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env,
  providerOverride?: string
): Promise<{ text: string; model?: string }> {
  const url = await env.STATS.get("config_local_whisper_url") || env.WHISPER_TURBO_URL || "http://whisper-turbo:8000";
  const modelName = "openai/whisper-large-v3-turbo";

  if (!url) throw new Error("Whisper Turbo URL not configured");

  const formData = new FormData();
  const blob = new Blob([audio], { type: "audio/ogg" });
  formData.append("file", blob, "audio.ogg");
  formData.append("model", modelName);
  formData.append("language", "auto");

  const secret = env.LOCAL_WHISPER_SECRET || ""; 

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 300000); // 300s (5m) to match Ingress timeout

  try {
    const response = await fetch(`${url}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}` },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Whisper Turbo error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    let text = result.text || result.transcription || "";

    // Hallucination cleanup: remove repeating sentences (3+ repetitions)
    text = text.replace(/(.+?\.)\s*\1\s*\1(\s*\1)*/g, '$1 $1');

    return { text, model: "whisper-turbo" };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
