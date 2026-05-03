import { Env } from "./types";

const MODEL = "@cf/openai/whisper-tiny-en";

interface WhisperResponse {
  text: string;
  detectedLang?: string;
  model?: string;
}

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<WhisperResponse> {
  const provider = await env.STATS.get("config_whisper_provider") as "cloudflare" | "local" | "ollama" | "qwen3-asr" || env.WHISPER_PROVIDER || "qwen3-asr";
  
  const kvLocalUrl = await env.STATS.get("config_local_whisper_url");
  const localUrl = kvLocalUrl || env.LOCAL_WHISPER_URL || "https://whisper-onnx.voicemsg.net";
  
  const kvLocalSecret = await env.STATS.get("config_local_whisper_secret");
  const localSecret = kvLocalSecret || env.LOCAL_WHISPER_SECRET || "whisper-sh-secret-2026";

  const kvOllamaUrl = await env.STATS.get("config_ollama_url");
  const ollamaUrl = kvOllamaUrl || env.OLLAMA_BASE_URL || "http://100.65.0.209:11434";

  const kvModel = await env.STATS.get("config_ollama_model");
  const ollamaModel = kvModel || env.OLLAMA_MODEL || "whisper";

  if (provider === "qwen3-asr") {
    const qwenUrl = kvOllamaUrl || env.OLLAMA_BASE_URL || "http://100.65.0.209:11434";
    if (!qwenUrl) throw new Error("Qwen3-ASR URL not configured");
    return transcribeQwenASR(audio, qwenUrl, env, localSecret);
  }

  if (provider === "ollama") {
    if (!ollamaUrl) throw new Error("Ollama URL not configured");
    return transcribeOllama(audio, ollamaUrl, ollamaModel, env, localSecret);
  }

  if (provider === "local") {
    if (!localUrl) throw new Error("Local Whisper URL not configured");
    return transcribeLocal(audio, localUrl, env, localSecret);
  }

  return transcribeCloudflare(audio, env, localUrl, localSecret);
}

async function transcribeCloudflare(
  audio: ArrayBuffer,
  env: Env,
  fallbackUrl?: string,
  fallbackSecret?: string
): Promise<WhisperResponse> {
  const input = {
    audio: Array.from(new Uint8Array(audio)),
  };

  console.log(`[whisper] Cloudflare: Audio size ${audio.byteLength} bytes`);

  try {
    // Cast through unknown to handle Ai.run typing limitations
    const result = await (env.AI.run as (model: string, input: any) => Promise<WhisperResponse>)(MODEL, input);

    if (!result || !result.text) {
      throw new Error(`Cloudflare Whisper returned empty result`);
    }

    return { ...result, model: "Cloudflare AI" };
  } catch (e) {
    console.error(`[whisper] Cloudflare Whisper failed: ${e}`);
    if (fallbackUrl) {
      console.log(`[whisper] Cloudflare failed, falling back to local/ollama`);
      return transcribeLocal(audio, fallbackUrl, env, fallbackSecret);
    }
    throw e;
  }
}

async function transcribeLocal(
  audio: ArrayBuffer,
  url: string,
  env: Env,
  secret?: string
): Promise<WhisperResponse> {
  console.log(`[whisper] Local: Audio size ${audio.byteLength} bytes, URL: ${url}`);
  
  const formData = new FormData();
  const blob = new Blob([audio], { type: "audio/ogg" });
  formData.append("file", blob, "audio.ogg");

  const headers: Record<string, string> = {
    "x-whisper-secret": secret || "",
  };

  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(`${url}/transcribe`, {
      method: "POST",
      headers,
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local Whisper [${url}] error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as WhisperResponse;
    console.log(`[whisper] Local Whisper succeeded: "${result.text?.substring(0, 50)}..."`);
    return { ...result, model: "Sherpa ONNX (Local)" };
  } catch (e) {
    clearTimeout(timeoutId);
    console.error(`[whisper] Local Whisper [${url}] failed: ${e}`);
    throw new Error(`Local Whisper [${url}] failed: ${(e as Error).message}`);
  }
}

async function transcribeOllama(
  audio: ArrayBuffer,
  url: string,
  model: string,
  env: Env,
  secret?: string
): Promise<WhisperResponse> {
  console.log(`[whisper] Ollama: Audio size ${audio.byteLength} bytes, URL: ${url}, Model: ${model}`);
  
  let binary = "";
  const bytes = new Uint8Array(audio);
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    // @ts-expect-error - apply with Uint8Array is faster but TS complains about spread limits
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64Audio = btoa(binary);

  const isNativeWhisper = model === "whisper";
  const endpoint = isNativeWhisper ? "/api/transcribe" : "/api/generate";
  const body = isNativeWhisper 
    ? { model, audio: base64Audio }
    : { model, prompt: `Transcribe this audio (base64): ${base64Audio}`, stream: false };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${secret || ""}`,
  };

  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for Ollama

  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    let transcribedText = isNativeWhisper ? result.text : result.response;
    
    // Auto-regressive ASR models often hallucinate repeating loops on silence.
    // Clean up repeating sentences
    if (transcribedText) {
      const sentences = transcribedText.split(/(?<=[.!?])\s+/);
      const cleaned = [];
      for (let i = 0; i < sentences.length; i++) {
        if (i >= 2 && sentences[i].trim() === sentences[i-1].trim() && sentences[i].trim() === sentences[i-2].trim()) {
          continue; // Skip consecutive identical sentences
        }
        cleaned.push(sentences[i]);
      }
      transcribedText = cleaned.join(' ').trim();
    }

    console.log(`[whisper] Ollama succeeded: "${transcribedText?.substring(0, 50)}..."`);
    return { text: transcribedText, model: `Ollama (${model})` };
  } catch (e) {
    clearTimeout(timeoutId);
    console.error(`[whisper] Ollama failed: ${e}`);
    throw e;
  }
}

async function transcribeQwenASR(
  audio: ArrayBuffer,
  url: string,
  env: Env,
  secret?: string
): Promise<WhisperResponse> {
  console.log(`[whisper] Qwen3-ASR: Audio size ${audio.byteLength} bytes, URL: ${url}`);

  let binary = "";
  const bytes = new Uint8Array(audio);
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    // @ts-expect-error - apply with Uint8Array is faster but TS complains about spread limits
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64Audio = btoa(binary);

  const body = {
    model: "qwen3-asr",
    audio: base64Audio,
    language: "auto" // Qwen supports automatic language detection
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${secret || ""}`,
  };

  if (env.CF_ACCESS_CLIENT_ID && env.CF_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = env.CF_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = env.CF_ACCESS_CLIENT_SECRET;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for Qwen3-ASR

  try {
    const response = await fetch(`${url}/v1/audio/transcriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen3-ASR server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    let transcribedText = result.text || result.transcription || result.response;
    
    // Auto-regressive ASR models often hallucinate repeating loops on silence.
    // Clean up repeating sentences (e.g., "I'm not using it. I'm not using it.")
    if (transcribedText) {
      const sentences = transcribedText.split(/(?<=[.!?])\s+/);
      const cleaned = [];
      for (let i = 0; i < sentences.length; i++) {
        if (i >= 2 && sentences[i].trim() === sentences[i-1].trim() && sentences[i].trim() === sentences[i-2].trim()) {
          continue; // Skip consecutive identical sentences
        }
        cleaned.push(sentences[i]);
      }
      transcribedText = cleaned.join(' ').trim();
    }

    console.log(`[whisper] Qwen3-ASR succeeded: "${transcribedText?.substring(0, 50)}..."`);
    return { text: transcribedText, model: "Qwen3-ASR" };
  } catch (e) {
    clearTimeout(timeoutId);
    console.error(`[whisper] Qwen3-ASR failed: ${e}`);
    throw e;
  }
}
