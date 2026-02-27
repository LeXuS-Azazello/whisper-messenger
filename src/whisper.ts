import { Env } from "./types";

const MODELS = [
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
  const input = {
    audio: [...new Uint8Array(audio)],
  };

  console.log(`[whisper] Audio size: ${audio.byteLength} bytes, array length: ${input.audio.length}`);

  let lastError: unknown;

  for (const model of MODELS) {
    try {
      console.log(`[whisper] Trying model: ${model}`);
      const result = await env.AI.run(model as any, input) as WhisperResponse;
      console.log(`[whisper] Model ${model} succeeded: text="${result.text?.substring(0, 100)}"`);
      return result;
    } catch (e) {
      console.error(`[whisper] Model ${model} failed: ${e}`);
      lastError = e;
    }
  }

  throw lastError;
}
