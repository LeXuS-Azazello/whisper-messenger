import { Env } from "./types";

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<{ text: string; model?: string }> {
  // Try to get provider from Redis, fallback to env var, then to default
  const provider = await env.STATS.get("config_whisper_provider") || env.WHISPER_PROVIDER || "qwen3-asr";
  
  let url = "";
  let modelName = "";

  if (provider === "whisper-turbo") {
    url = await env.STATS.get("config_local_whisper_url") || env.WHISPER_TURBO_URL || "http://whisper-turbo:8000";
    modelName = "openai/whisper-large-v3-turbo";
  } else if (provider === "ollama") {
    url = await env.STATS.get("config_ollama_url") || env.OLLAMA_BASE_URL || "http://qwen3-asr:8000";
    modelName = await env.STATS.get("config_whisper_model") || "qwen2-audio";
  } else {
    // Default to Qwen3-ASR
    url = env.QWEN_ASR_URL || env.OLLAMA_BASE_URL || "http://qwen3-asr:8000";
    modelName = "Qwen/Qwen3-ASR-0.6B";
  }

  if (!url) throw new Error(`${provider} URL not configured`);

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
      throw new Error(`${provider} error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    let text = result.text || result.transcription || "";

    // Hallucination cleanup: remove repeating sentences (3+ repetitions)
    text = text.replace(/(.+?\.)\s*\1\s*\1(\s*\1)*/g, '$1 $1');

    return { text, model: provider };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
