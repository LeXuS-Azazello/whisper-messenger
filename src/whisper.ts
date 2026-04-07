import { Env } from "./types";

const MODEL = "@cf/openai/whisper-tiny-en";

interface WhisperResponse {
  text: string;
}

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<WhisperResponse> {
  const kvProvider = await env.STATS.get("config_whisper_provider") as "cloudflare" | "local" | null;
  const provider = kvProvider || env.WHISPER_PROVIDER || "cloudflare";
  
  const kvUrl = await env.STATS.get("config_local_whisper_url");
  const localUrl = kvUrl || env.LOCAL_WHISPER_URL;
  
  const kvSecret = await env.STATS.get("config_local_whisper_secret");
  const localSecret = kvSecret || env.LOCAL_WHISPER_SECRET;

  if (provider === "local" && localUrl) {
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
    // @ts-ignore
    const result = await env.AI.run(MODEL, input) as WhisperResponse;

    if (!result || !result.text) {
      throw new Error(`Cloudflare Whisper returned empty result`);
    }

    return result;
  } catch (e) {
    console.error(`[whisper] Cloudflare Whisper failed: ${e}`);
    if (fallbackUrl) {
      console.log(`[whisper] Cloudflare failed, falling back to LOCAL`);
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
      throw new Error(`Local Whisper server returned ${response.status}: ${errorText}`);
    }

    const result = await response.json() as WhisperResponse;
    console.log(`[whisper] Local Whisper succeeded: "${result.text?.substring(0, 50)}..."`);
    return result;
  } catch (e) {
    console.error(`[whisper] Local Whisper failed: ${e}`);
    throw e;
  }
}
