import { Env } from "./types";

export interface TranscriptionResult {
  text: string;
  detectedLanguage: string;
  translated?: string | null;
  targetLanguage?: string | null;
  model?: string;
}

/**
 * Calls whisper-service-v2 with auto language detection + optional translation.
 * This is the recommended function for all messengers.
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  env: Env,
  targetLanguage?: string | null
): Promise<TranscriptionResult> {
  const url = await env.STATS.get("config_local_whisper_url") 
    || env.WHISPER_PROVIDER 
    || "http://whisper-service-v2.debugging-testcrash-pub.svc.cluster.local:8000";

  if (!url) throw new Error("Whisper Turbo URL not configured");

  const isSenseVoice = url.includes('sensevoice') || url.includes('50000');
  const isFunASR = url.includes('funasr') || url.includes('50001');
  const secret = env.WHISPER_SECRET || "";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    let response;
    
    if (isFunASR) {
      const formData = new FormData();
      formData.append("file", new Blob([audio], { type: 'audio/wav' }), "audio.wav");
      formData.append("model", "paraformer");
      formData.append("response_format", "json");

      response = await fetch(`${url}/v1/audio/transcriptions`, {
        method: "POST",
        headers: secret ? { "Authorization": `Bearer ${secret}` } : {},
        body: formData,
        signal: controller.signal
      });
    } else if (isSenseVoice) {
      const formData = new FormData();
      formData.append("files", new Blob([audio], { type: 'audio/wav' }), "audio.wav");
      formData.append("keys", "audio");
      formData.append("lang", "auto");
      formData.append("use_itn", "false");
      
      response = await fetch(`${url}/api/v1/asr`, {
        method: "POST",
        body: formData,
        signal: controller.signal
      });
    } else {
      const base64Data = Buffer.from(audio).toString('base64');
      const payload: any = {
        file_data: base64Data,
        language: "auto"
      };
      if (targetLanguage) {
        payload.target_language = targetLanguage;
      }
      response = await fetch(`${url}/v1/transcribe-base64`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${secret}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ASR service error ${response.status}: ${errorText}`);
    }

    const result = await response.json() as any;

    let text = "";
    if (isSenseVoice) {
      // SenseVoice response: {"result": [{"text": "...", "language": "en"}]}
      const resData = result.result && result.result[0];
      text = resData ? resData.text : "";
      result.language = resData ? resData.language : "unknown";
      
      // SenseVoice hallucination cleanup
      text = text.replace(/<\|.*?\|>/g, '').trim();
      if (/^(嗯|啊|哦|угу|м|да|ну)+[.!?,。]*$/i.test(text) || text === '嗯' || text === '嗯.' || text === '嗯。') {
          text = '';
      }
    } else {
      text = result.text || result.transcription || "";
    }

    // Hallucination cleanup
    text = text.replace(/(.+?\.)\s*\1\s*\1(\s*\1)*/g, '$1 $1');

    const detectedLanguage = result.language || result.detected_language || "unknown";
    let translatedText = result.translated || null;

    if (targetLanguage && targetLanguage !== "off" && !translatedText) {
      const isSameLanguage = detectedLanguage && targetLanguage 
          && (detectedLanguage.toLowerCase().startsWith(targetLanguage.toLowerCase()) 
              || targetLanguage.toLowerCase().startsWith(detectedLanguage.toLowerCase()));
      if (!isSameLanguage) {
        try {
          const { default: translate } = await import("google-translate-api-x");
          const transResult = (await translate(text, { to: targetLanguage })) as any;
          if (transResult && transResult.text) {
            translatedText = transResult.text;
          }
        } catch (transErr: any) {
          console.error(`[transcribeAudio] Translation error:`, transErr.message);
        }
      }
    }

    return {
      text,
      detectedLanguage,
      translated: translatedText,
      targetLanguage: targetLanguage || null,
      model: isFunASR ? "funasr" : (isSenseVoice ? "sensevoice" : "whisper-service-v2 (large-v3-turbo)")
    };
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}

/** Legacy wrapper for backward compatibility */
export async function transcribeWithFallback(
  audio: ArrayBuffer,
  env: Env,
  providerOverride?: string
): Promise<{ text: string; model?: string }> {
  const res = await transcribeAudio(audio, env);
  return { text: res.text, model: res.model };
}