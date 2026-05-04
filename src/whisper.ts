import { Env } from "./types";

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<{ text: string; model?: string }> {
  // Always use Qwen3-ASR (no fallback, only one provider)
  const qwenUrl = env.OLLAMA_BASE_URL || "http://qwen3-asr:11434";
  if (!qwenUrl) throw new Error("Qwen3-ASR URL not configured");

  const formData = new FormData();
  const blob = new Blob([audio], { type: "audio/ogg" });
  formData.append("file", blob, "audio.ogg");
  formData.append("model", "qwen3-asr");
  formData.append("language", "auto");

  const secret = env.LOCAL_WHISPER_SECRET || ""; // reuse secret var for auth

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${qwenUrl}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${secret}` },
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen3-ASR error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    const text = result.text || result.transcription || "";
    return { text, model: "Qwen3-ASR" };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
