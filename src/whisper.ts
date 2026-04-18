import { Env } from "./types";

const MODEL = "@cf/openai/whisper-tiny-en";

interface WhisperResponse {
  text: string;
  detectedLang?: string;
}

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<WhisperResponse> {
  const provider = await env.STATS.get("config_whisper_provider") as "cloudflare" | "local" | "ollama" || env.WHISPER_PROVIDER || "ollama";
  
  const kvLocalUrl = await env.STATS.get("config_local_whisper_url");
  const localUrl = kvLocalUrl || env.LOCAL_WHISPER_URL;
  
  const kvLocalSecret = await env.STATS.get("config_local_whisper_secret");
  const localSecret = kvLocalSecret || env.LOCAL_WHISPER_SECRET;

  const kvOllamaUrl = await env.STATS.get("config_ollama_url");
  const ollamaUrl = kvOllamaUrl || env.OLLAMA_BASE_URL;
  
  const kvModel = await env.STATS.get("config_ollama_model");
  const ollamaModel = kvModel || env.OLLAMA_MODEL || "whisper";

  if (provider === "ollama") {
    if (!ollamaUrl) throw new Error("Ollama URL not configured");
    return transcribeOllama(audio, ollamaUrl, ollamaModel, localSecret);
  }
  
  if (provider === "local") {
    if (!localUrl) throw new Error("Local Whisper URL not configured");
    return transcribeLocal(audio, localUrl, localSecret);
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
    audio: new Uint8Array(audio),
  };

  console.log(`[whisper] Cloudflare: Audio size ${audio.byteLength} bytes`);

  try {
    // Cast through unknown to handle Ai.run typing limitations
    const result = await (env.AI.run as (model: string, input: { audio: Uint8Array }) => Promise<WhisperResponse>)(MODEL, input);

    if (!result || !result.text) {
      throw new Error(`Cloudflare Whisper returned empty result`);
    }

    return result;
  } catch (e) {
    console.error(`[whisper] Cloudflare Whisper failed: ${e}`);
    if (fallbackUrl) {
      console.log(`[whisper] Cloudflare failed, falling back to local/ollama`);
      return transcribeLocal(audio, fallbackUrl, fallbackSecret);
    }
    throw e;
  }
}

async function transcribeLocal(
  audio: ArrayBuffer,
  url: string,
  secret?: string
): Promise<WhisperResponse> {
  console.log(`[whisper] Local: Audio size ${audio.byteLength} bytes, URL: ${url}`);
  
  const formData = new FormData();
  const blob = new Blob([audio], { type: "audio/ogg" });
  formData.append("file", blob, "audio.ogg");

  try {
    const response = await fetch(`${url}/transcribe`, {
      method: "POST",
      headers: {
        "x-whisper-secret": secret || "",
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Local Whisper [${url}] error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as WhisperResponse;
    console.log(`[whisper] Local Whisper succeeded: "${result.text?.substring(0, 50)}..."`);
    return result;
  } catch (e) {
    console.error(`[whisper] Local Whisper [${url}] failed: ${e}`);
    throw new Error(`Local Whisper [${url}] failed: ${(e as Error).message}`);
  }
}

async function transcribeOllama(
  audio: ArrayBuffer,
  url: string,
  model: string,
  secret?: string
): Promise<WhisperResponse> {
  console.log(`[whisper] Ollama: Audio size ${audio.byteLength} bytes, URL: ${url}, Model: ${model}`);
  
  let binary = "";
  const bytes = new Uint8Array(audio);
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK_SIZE) as any);
  }
  const base64Audio = btoa(binary);

  const isNativeWhisper = model === "whisper";
  const endpoint = isNativeWhisper ? "/api/transcribe" : "/api/generate";
  const body = isNativeWhisper 
    ? { model, audio: base64Audio }
    : { model, prompt: `Transcribe this audio (base64): ${base64Audio}`, stream: false };

  try {
    const response = await fetch(`${url}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret || ""}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;
    const transcribedText = isNativeWhisper ? result.text : result.response;
    console.log(`[whisper] Ollama succeeded: "${transcribedText?.substring(0, 50)}..."`);
    return { text: transcribedText };
  } catch (e) {
    console.error(`[whisper] Ollama failed: ${e}`);
    throw e;
  }
}
