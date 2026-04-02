import { Env } from "./types";

const MODELS = [
  "@cf/openai/whisper-tiny-en",
  "@cf/openai/whisper-large-v3-turbo",
  "@cf/openai/whisper",
];

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

  let lastError: unknown;

  for (const model of MODELS) {
    try {
      console.log(`[whisper] Trying model: ${model}`);
      // @ts-ignore - Cloudflare Workers AI types can be tricky
      const result = await env.AI.run(model, input) as WhisperResponse;

      if (!result || !result.text) {
        console.warn(`[whisper] Model ${model} returned empty/invalid result`);
        continue;
      }

      console.log(`[whisper] Model ${model} succeeded: text="${result.text?.substring(0, 100)}"`);
      return result;
    } catch (e) {
      console.error(`[whisper] Model ${model} failed: ${e}`);
      lastError = e;
    }
  }

  throw lastError || new Error("All whisper models failed");
}
