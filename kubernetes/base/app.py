import base64
import os
import sys
import io
import time
import tempfile
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
import soundfile as sf
import torchaudio.functional as F

import torchaudio
import numpy as np

os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

torch.set_num_threads(4)
torch.set_num_interop_threads(1)

TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["MODELSCOPE_CACHE"] = TTS_MODEL_DIR
MODEL_NAME = os.getenv("SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")

_local_model_path = os.path.join(TTS_MODEL_DIR, "hub", MODEL_NAME.replace("/", "/"))
MODEL_LOAD_PATH = _local_model_path if os.path.isdir(_local_model_path) else MODEL_NAME

print(f"[samesame-cosy] Initializing CosyVoice3: {MODEL_LOAD_PATH}")

if not os.path.isdir(_local_model_path):
    print(f"[samesame-cosy] Model not found at {_local_model_path}, waiting for downloader job...")
    for i in range(120):
        time.sleep(5)
        if os.path.isdir(_local_model_path):
            print(f"[samesame-cosy] Model appeared after {i*5}s")
            break
    else:
        print(f"[samesame-cosy] FATAL: Model not found after 10 minutes, exiting")
        sys.exit(1)

sys.path.append("/app/CosyVoice")
sys.path.append("/app/CosyVoice/third_party/Matcha-TTS")

from cosyvoice.utils.file_utils import logging, load_wav
from cosyvoice.cli.cosyvoice import CosyVoice3

try:
    cosyvoice = CosyVoice3(MODEL_LOAD_PATH, load_trt=False, fp16=False)
    print(f"[samesame-cosy] CosyVoice3 loaded successfully.")
    # Warmup
    print("[samesame] warmup...")
except Exception as e:
    print(f"[samesame-cosy] FATAL: Failed to load CosyVoice3: {e}")
    sys.exit(1)

SAMPLE_RATE = cosyvoice.sample_rate
SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
app = FastAPI(title="Samesame CosyVoice Service")


def detect_language_from_text(text: str) -> str:
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04ff')
    if cyrillic > max(2, len(text) * 0.15):
        if any(ch.lower() in set('ґєії') for ch in text):
            return 'uk'
        return 'ru'
    if sum(1 for c in text if '\u0e00' <= c <= '\u0e7f') > 0:
        return 'th'
    if sum(1 for c in text if '\u0590' <= c <= '\u05ff') > 0:
        return 'he'
    return 'en'


def decode_audio_base64(audio_b64: str, target_sr: int = 16000) -> tuple[torch.Tensor, int]:
    audio_bytes = base64.b64decode(audio_b64)
    audio_stream = io.BytesIO(audio_bytes)
    waveform, orig_sr = sf.read(audio_stream, dtype='float32')
    if waveform.ndim == 1:
        waveform = waveform.reshape(1, -1)
    else:
        waveform = waveform.T
    tensor = torch.from_numpy(waveform).float()
    if orig_sr != target_sr:
        tensor = F.resample(tensor, orig_sr, target_sr)
    return tensor, target_sr


class CloneRequest(BaseModel):
    source_audio_base64: str
    text: str
    prompt_text: Optional[str] = ""
    prompt_language: Optional[str] = None
    language: Optional[str] = None
    output_format: Optional[str] = "ogg"


@app.get("/health")
@app.get("/live")
def health():
    return {"status": "ok", "model": MODEL_NAME, "backend": "cosyvoice3"}


@app.post("/v1/clone")
def clone_voice(
    req: CloneRequest,
    authorization: Optional[str] = Header(None)
):
    start_time = time.time()

    if SAMESAME_SECRET and authorization != f"Bearer {SAMESAME_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    try:
        prompt_speech_16k, _ = decode_audio_base64(req.source_audio_base64, target_sr=16000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}")

    # Limit prompt to 60 seconds
    MAX_PROMPT_SAMPLES = 16000 * 60
    if prompt_speech_16k.shape[-1] > MAX_PROMPT_SAMPLES:
        prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_SAMPLES]

    lang = (req.language or "").strip().lower()[:2] or detect_language_from_text(req.text)
    if lang not in {"ru","uk","th","he","en","zh","ja","ko","de","es","fr","it"}:
        lang = "en"

    cosy_tag = "ru" if lang == "uk" else lang

    # Split text
    text = req.text
    if len(text) > 200:
        for i, char in enumerate(text):
            if char in '.!?。！？' and i > 100:
                text = text[:i+1]
                break
    text_chunks = [text] if len(text) <= 200 else [text[:200]]

    print(f"[cosy] target={lang}, chunks={len(text_chunks)}")

    try:
        all_audio_chunks = []

        # Write prompt to temp WAV file (CosyVoice3 needs file path)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_path = tmp.name
            sf.write(tmp_path, prompt_speech_16k.squeeze(0).cpu().numpy(), 16000)

        for chunk_text in text_chunks:
            prompt_text = f"<|{cosy_tag}|>{chunk_text}"
            print(f"[cosy] synthesizing: {chunk_text[:50]}...")

            output = cosyvoice.inference_zero_shot(
                tts_text=chunk_text,
                prompt_text=prompt_text,
                prompt_wav=tmp_path
            )

            for item in output:
                if "tts_speech" in item:
                    all_audio_chunks.append(item["tts_speech"].squeeze().cpu().numpy())

        os.unlink(tmp_path)

        if not all_audio_chunks:
            raise ValueError("empty audio")

        audio = np.concatenate(all_audio_chunks) if len(all_audio_chunks) > 1 else all_audio_chunks[0]

    except Exception as e:
        import traceback
        print(f"[cosy] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

    buf = io.BytesIO()
    mime = "audio/ogg"

    try:
        sf.write(buf, audio, SAMPLE_RATE, format="OGG", subtype="OPUS")
    except:
        buf = io.BytesIO()
        sf.write(buf, audio, SAMPLE_RATE, format="WAV")
        mime = "audio/wav"

    return {
        "audio_base64": base64.b64encode(buf.getvalue()).decode(),
        "mime_type": mime,
        "duration_seconds": round(len(audio) / SAMPLE_RATE, 2),
        "latency_ms": int((time.time() - start_time) * 1000)
    }