import { Env } from "./types";

const MODEL = "@cf/openai/whisper-tiny-en";

interface WhisperResponse {
  text: string;
}

export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env
): Promise<WhisperResponse> {
  const audioArray = Array.from(new Uint8Array(audio));
  const input = {
    audio: audioArray,
  };

  console.log(`[whisper] Audio size: ${audio.byteLength} bytes, array length: ${input.audio.length}`);

  try {
    console.log(`[whisper] Trying model: ${MODEL}`);
    // @ts-ignore - Cloudflare Workers AI types can be tricky
    const result = await env.AI.run(MODEL, input) as WhisperResponse;

    if (!result || !result.text) {
      throw new Error(`Model ${MODEL} returned empty/invalid result`);
    }

    console.log(`[whisper] Model ${MODEL} succeeded: text="${result.text?.substring(0, 100)}"`);
    return result;
  } catch (e) {
    console.error(`[whisper] Model ${MODEL} failed: ${e}`);
    throw e;
  }
}
