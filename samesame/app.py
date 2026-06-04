import base64
import hashlib
import io
import os
import re
import sys
import time
import uuid
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
import soundfile as sf
import torchaudio.functional as F
import numpy as np
from redis import Redis, ConnectionPool

os.environ["CUDA_VISIBLE_DEVICES"] = ""
CPU_THREADS = int(os.getenv("CPU_THREADS", "4"))
os.environ["OMP_NUM_THREADS"] = str(CPU_THREADS)
os.environ["MKL_NUM_THREADS"] = str(CPU_THREADS)
os.environ["TOKENIZERS_PARALLELISM"] = "false"

torch.set_num_threads(CPU_THREADS)
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
except Exception as e:
    print(f"[samesame-cosy] FATAL: Failed to load CosyVoice3: {e}")
    sys.exit(1)

SAMPLE_RATE = cosyvoice.sample_rate
SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
app = FastAPI(title="Samesame CosyVoice Service")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_TTL = int(os.getenv("PROMPT_CACHE_TTL", "1800"))

pool = ConnectionPool(
    host=REDIS_HOST,
    port=REDIS_PORT,
    max_connections=20,
    socket_timeout=3,
    socket_connect_timeout=3
)

redis_client = Redis(
    connection_pool=pool,
    decode_responses=False
)

try:
    warm_file = "/dev/shm/warmup.wav"
    sf.write(warm_file, np.zeros(16000 * 3), 16000)
    list(
        cosyvoice.inference_zero_shot(
            tts_text="test voice cloning warmup",
            prompt_text="",
            prompt_wav=warm_file,
            text_frontend=False
        )
    )
    os.remove(warm_file)
    print("[warmup] done")
except Exception as e:
    print("[warmup]", e)


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


def split_text(text: str, max_len: int = 150) -> list:
    parts = []
    current = ""
    tokens = re.split(r'([.!?。！？])', text)
    for token in tokens:
        if len(current) + len(token) < max_len:
            current += token
        else:
            if current.strip():
                parts.append(current.strip())
            current = token
    if current.strip():
        parts.append(current.strip())
    return parts


def decode_audio_base64(audio_b64: str, target_sr: int = 16000) -> tuple[torch.Tensor, int]:
    audio_bytes = base64.b64decode(audio_b64)
    audio_stream = io.BytesIO(audio_bytes)
    waveform, orig_sr = sf.read(audio_stream, dtype='float32')
    
    if waveform.ndim > 1:
        waveform = waveform.mean(axis=1)
    
    waveform = waveform.reshape(1, -1)
    tensor = torch.from_numpy(waveform).float()
    
    if orig_sr != target_sr:
        tensor = F.resample(tensor, orig_sr, target_sr)
    return tensor, target_sr


def prompt_cache_filename(audio_b64: str) -> str:
    return hashlib.sha256(audio_b64.encode()).hexdigest()


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
    redis_ok = False
    try:
        redis_ok = redis_client.ping()
    except:
        pass
    return {"status": "ok", "model": MODEL_NAME, "backend": "cosyvoice3", "redis": redis_ok}


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
        t0 = time.time()
        prompt_speech_16k, _ = decode_audio_base64(req.source_audio_base64, target_sr=16000)
        print(f"[cosy] decode time: {time.time()-t0:.3f}s")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {e}")

    MAX_PROMPT_SAMPLES = 16000 * 8
    if prompt_speech_16k.shape[-1] > MAX_PROMPT_SAMPLES:
        prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_SAMPLES]

    # Trim silence
    audio_np = prompt_speech_16k.squeeze(0).cpu().numpy()
    mask = np.abs(audio_np) > 0.01
    if np.any(mask):
        indices = np.where(mask)[0]
        start = indices[0]
        end = indices[-1] + 1
        prompt_speech_16k = torch.from_numpy(audio_np[start:end]).unsqueeze(0).float()

    lang = (req.language or "").strip().lower()[:2] or detect_language_from_text(req.text)
    if lang not in {"ru","uk","th","he","en","zh","ja","ko","de","es","fr","it"}:
        lang = "en"

    FAST_LANGS = {"ru", "uk", "en", "de", "fr", "es", "it", "pt"}
    use_frontend = lang not in FAST_LANGS

    text_chunks = split_text(req.text, max_len=250)
    print(f"[cosy] target={lang}, chunks={len(text_chunks)}")

    cache_key = prompt_cache_filename(req.source_audio_base64)
    cache_file = f"/dev/shm/{cache_key}-{uuid.uuid4().hex}.flac"
    
    cached_audio = None
    try:
        cached_audio = redis_client.get(cache_key)
    except Exception as e:
        print("[redis get]", e)

    if cached_audio:
        with open(cache_file, "wb") as f:
            f.write(cached_audio)
    else:
        wav_bytes = io.BytesIO()
        sf.write(wav_bytes, prompt_speech_16k.squeeze(0).cpu().numpy(), 16000, format="FLAC")
        payload = wav_bytes.getvalue()
        try:
            redis_client.setex(cache_key, REDIS_TTL, payload)
        except Exception as e:
            print("[redis set]", e)
        with open(cache_file, "wb") as f:
            f.write(payload)

    try:
        all_audio_chunks = []
        t1 = time.time()
        for chunk_text in text_chunks:
            prompt_text_str = req.prompt_text or chunk_text[:80]
            print(f"[cosy] synthesizing: {chunk_text[:50]}...")

            output = cosyvoice.inference_zero_shot(
                tts_text=chunk_text,
                prompt_text=prompt_text_str,
                prompt_wav=cache_file,
                text_frontend=use_frontend
            )

            for item in output:
                if "tts_speech" in item:
                    all_audio_chunks.append(item["tts_speech"].squeeze().cpu().numpy())
        print(f"[cosy] infer time: {time.time()-t1:.3f}s")

        if not all_audio_chunks:
            raise ValueError("empty audio")

        audio = np.concatenate(all_audio_chunks) if len(all_audio_chunks) > 1 else all_audio_chunks[0]

    except Exception as e:
        import traceback
        print(f"[cosy] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(cache_file)
        except:
            pass

    buf = io.BytesIO()
    mime = "audio/wav"

    t2 = time.time()
    sf.write(buf, audio, SAMPLE_RATE, format="WAV")
    print(f"[cosy] encode time: {time.time()-t2:.3f}s")

    return {
        "audio_base64": base64.b64encode(buf.getvalue()).decode(),
        "mime_type": mime,
        "duration_seconds": round(len(audio) / SAMPLE_RATE, 2),
        "latency_ms": int((time.time() - start_time) * 1000),
        "language": lang
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8002
    )