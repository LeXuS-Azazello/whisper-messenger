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

  let lastError: unknown;

  for (const model of MODELS) {
    try {
      return await env.AI.run(model as any, input) as WhisperResponse;
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError;
}
