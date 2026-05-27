import base64
import os
import sys
import tempfile
import subprocess
import re
from typing import Optional
import time

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

import torch

# Disable GPU / align CPU multithreading with k8s quota (1.5 CPU)
os.environ["CUDA_VISIBLE_DEVICES"] = "0"
os.environ["OMP_NUM_THREADS"] = "2"
torch.set_num_threads(2)

TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["MODELSCOPE_CACHE"] = TTS_MODEL_DIR
MODEL_NAME = os.environ.get("SAMESAME_MODEL_NAME", "iic/CosyVoice2-0.5B")

print("[samesame-cosy] Initializing CosyVoice model: {}".format(MODEL_NAME))
sys.path.append("/app/CosyVoice")
sys.path.append("/app/CosyVoice/third_party/Matcha-TTS")

from cosyvoice.utils.file_utils import load_wav
import torchaudio

# CosyVoice2-0.5B uses the CosyVoice2 class
try:
    from cosyvoice.cli.cosyvoice import CosyVoice2
    try:
        cosyvoice = CosyVoice2(MODEL_NAME, load_jit=True, load_trt=False)
       # print(f"[samesame-cosy] CosyVoice2 loaded with JIT: {MODEL_NAME}")
    except Exception as jit_err:
        # print(f"[samesame-cosy] JIT failed ({jit_err}), falling back to non-JIT...")
        cosyvoice = CosyVoice2(MODEL_NAME, load_jit=False, load_trt=False)
       # print(f"[samesame-cosy] CosyVoice2 loaded without JIT: {MODEL_NAME}")
except Exception as e:
    # print(f"[samesame-cosy] CosyVoice2 failed ({e}), falling back to CosyVoice (300M API)...")
    try:
        from cosyvoice.cli.cosyvoice import CosyVoice
        cosyvoice = CosyVoice(MODEL_NAME, load_jit=False)
        # print(f"[samesame-cosy] CosyVoice (compat) loaded: {MODEL_NAME}")
    except Exception as e2:
        # print(f"[samesame-cosy] FATAL: Failed to load any CosyVoice model: {e2}")
        sys.exit(1)

# Load Whisper ONCE at startup for prompt transcription (needed for zero_shot)
import whisper
print("[samesame-cosy] Loading Whisper base model for prompt transcription...")
whisper_model = whisper.load_model("base", device="cpu")
print("[samesame-cosy] Whisper model loaded.")

# CosyVoice2 outputs at 22050 Hz
SAMPLE_RATE = 22050

SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
app = FastAPI(title="Samesame CosyVoice Service")


def detect_language_from_text(text: str) -> str:
    """Detect language for supported languages.
    Returns two‑letter ISO code: 'ru', 'uk', 'th', 'he', 'en'.
    Prioritises Cyrillic → ru/uk, Thai → th, Hebrew → he, else en.
    """
    # Count Cyrillic characters (Russian/Ukrainian)
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
    if cyrillic > max(2, len(text) * 0.15):
        # Distinguish Ukrainian specific letters
        uk_specific = set('ґєії')
        if any(ch.lower() in uk_specific for ch in text):
            return 'uk'
        return 'ru'
    # Thai block
    thai = sum(1 for c in text if '\u0e00' <= c <= '\u0e7f')
    if thai > 0:
        return 'th'
    # Hebrew block
    hebrew = sum(1 for c in text if '\u0590' <= c <= '\u05ff')
    if hebrew > 0:
        return 'he'
    return 'en'


class CloneRequest(BaseModel):
    source_audio_base64: str
    source_mime_type: Optional[str] = "audio/ogg"
    text: str
    language: Optional[str] = None
    output_format: Optional[str] = "ogg"
    stream: Optional[bool] = False


@app.get("/health")
@app.get("/live")
def health():
    return {"status": "ok", "model": MODEL_NAME, "backend": "cosyvoice2"}


@app.post("/v1/clone")
def clone_voice(req: CloneRequest, authorization: Optional[str] = Header(None)):
    start_time = time.time()
    if SAMESAME_SECRET and authorization != f"Bearer {SAMESAME_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    try:
        audio_bytes = base64.b64decode(req.source_audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 in source_audio_base64")

    # Determine target language (requested or detected)
    lang = (req.language or "").strip().lower()[:2] if req.language else ""
    if not lang:
        lang = detect_language_from_text(req.text)
    # Whitelist allowed languages; default to English if unsupported
    allowed_langs = {"ru", "uk", "th", "he", "en"}
    if lang not in allowed_langs:
        print(f"[samesame-cosy] Requested language '{lang}' not supported, falling back to 'en'")
        lang = "en"
    print(f"[samesame-cosy] Text lang={lang} (req.language={req.language!r}), text_len={len(req.text)}")
    print(f"[samesame-cosy] Text preview: {req.text[:80]!r}")

    # Save prompt audio to temp file
    fd_in, temp_in = tempfile.mkstemp(suffix=".ogg")
    os.write(fd_in, audio_bytes)
    os.close(fd_in)

    temp_out = None
    try:
        # Load prompt speech at 16 kHz
        prompt_speech_16k = load_wav(temp_in, 16000)

        # Truncate prompt audio to 29 seconds max (CosyVoice limit is 30s)
        MAX_PROMPT_LEN = 16000 * 29
        if prompt_speech_16k.shape[1] > MAX_PROMPT_LEN:
            print(f"[samesame-cosy] Truncating prompt audio from {prompt_speech_16k.shape[1]/16000:.1f}s to 29.0s")
            prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_LEN]
            # Save truncated audio back to temp_in for Whisper
            torchaudio.save(temp_in, prompt_speech_16k, 16000)

        # Transcribe prompt with Whisper to get prompt_text for zero_shot
        print("[samesame-cosy] Transcribing prompt audio with Whisper...")
        whisper_result = whisper_model.transcribe(temp_in, language=None)
        prompt_text = (whisper_result.get("text") or "").strip()
        prompt_lang = (whisper_result.get("language") or "").lower()[:2]
        print(f"[samesame-cosy] Prompt lang={prompt_lang}, text={prompt_text[:80]!r}")

        # Decide inference strategy: always use zero_shot when target language is allowed
        # (zero_shot gives best quality). If Whisper failed to detect language, fallback to cross_lingual.
        tts_audios = []
        if prompt_text and (prompt_lang == lang or not prompt_lang):
            print(f"[samesame-cosy] Strategy: zero_shot (lang={lang})")
            output = cosyvoice.inference_zero_shot(
                req.text, prompt_text, prompt_speech_16k, stream=False
            )
        else:
            print(f"[samesame-cosy] Strategy: cross_lingual (prompt_lang={prompt_lang} → tts_lang={lang})")
            output = cosyvoice.inference_cross_lingual(
                req.text, prompt_speech_16k, stream=False
            )

        for chunk in output:
            if "tts_speech" in chunk:
                tts_audios.append(chunk["tts_speech"])

        if not tts_audios:
            raise ValueError("CosyVoice returned no tts_speech chunks")

        tts_audio = torch.cat(tts_audios, dim=1)
        print(f"[samesame-cosy] Generated shape={tts_audio.shape}, sr={SAMPLE_RATE}")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"CosyVoice generation failed: {e}")
    finally:
        try:
            os.remove(temp_in)
        except Exception:
            pass

    # Save WAV at correct sample rate (CosyVoice2 = 22050 Hz)
    fd_out, temp_out = tempfile.mkstemp(suffix=".wav")
    os.close(fd_out)

    try:
        torchaudio.save(temp_out, tts_audio, SAMPLE_RATE)

        if req.output_format == "ogg":
            fd_ogg, temp_ogg = tempfile.mkstemp(suffix=".ogg")
            os.close(fd_ogg)
            subprocess.run(
                ["ffmpeg", "-y", "-i", temp_out,
                 "-c:a", "libopus", "-b:a", "128k", temp_ogg],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            os.remove(temp_out)
            temp_out = temp_ogg
            mime = "audio/ogg"
        else:
            mime = "audio/wav"

        with open(temp_out, "rb") as f:
            out_bytes = f.read()

    finally:
        try:
            if temp_out and os.path.exists(temp_out):
                os.remove(temp_out)
        except Exception:
            pass

    latency_ms = int((time.time() - start_time) * 1000)
    return {
        "content_type": mime,
        "audio_base64": base64.b64encode(out_bytes).decode("utf-8"),
        "model": MODEL_NAME,
        "latency_ms": latency_ms
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8002)
