import base64
import io
import os
import subprocess
import sys
import tempfile
from typing import Optional

# Hotfix: install torchcodec dynamically since it's required by latest torchaudio
try:
    import torchcodec
except ImportError:
    print("[samesame] Installing torchcodec hotfix...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "torchcodec"])

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from starlette.responses import StreamingResponse

import torch
original_load = torch.load
def safe_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return original_load(*args, **kwargs)
torch.load = safe_load

# Speed up PyTorch CPU inference
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"
torch.set_num_threads(4)

os.environ["XDG_DATA_HOME"] = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["TRANSFORMERS_CACHE"] = os.environ.get("TTS_MODEL_DIR", "/models")

# The TTS model will be downloaded into TTS_MODEL_DIR and loaded at startup.
from TTS.api import TTS # type: ignore

app = FastAPI(title="SAMESAME Voice Clone Service")

HUGGINGFACE_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")
if HUGGINGFACE_API_KEY:
    os.environ.setdefault("HUGGINGFACE_API_KEY", HUGGINGFACE_API_KEY)
    os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", HUGGINGFACE_API_KEY)

HF_HOME = os.environ.get("HF_HOME", "/models")
os.environ.setdefault("HF_HOME", HF_HOME)
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")
if os.environ.get("SAMESAME_LOCAL_ONLY", "true").lower() in ("1", "true", "yes"):
    os.environ.setdefault("HF_LOCAL_FILES_ONLY", "true")

SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET", "changeme")
MODEL_NAME = os.environ.get(
    "SAMESAME_MODEL_NAME", "tts_models/multilingual/multi-dataset/xtts_v2"
)
TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
OUTPUT_SAMPLE_RATE = int(os.environ.get("SAMESAME_SAMPLE_RATE", "22050"))
DEFAULT_LANGUAGE = os.environ.get("SAMESAME_DEFAULT_LANGUAGE", "ru")

os.environ["TTS_MODEL_DIR"] = TTS_MODEL_DIR


class CloneRequest(BaseModel):
    source_audio_base64: str
    source_mime_type: str = "audio/ogg"
    text: str
    language: Optional[str] = None
    output_format: Optional[str] = "wav"


def run_ffmpeg_decode(input_bytes: bytes, output_path: str) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            "pipe:0",
            "-ar",
            str(OUTPUT_SAMPLE_RATE),
            "-ac",
            "1",
            output_path,
        ],
        input=input_bytes,
        check=True,
        capture_output=True,
    )


def run_ffmpeg_encode_wav_to_ogg(wav_bytes: bytes) -> bytes:
    result = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "wav",
            "-i",
            "pipe:0",
            "-c:a",
            "libopus",
            "-b:a",
            "96k",
            "-f",
            "ogg",
            "pipe:1",
        ],
        input=wav_bytes,
        check=True,
        capture_output=True,
    )
    return result.stdout


def wav_bytes_from_numpy(wav, sample_rate: int) -> bytes:
    import scipy.io.wavfile
    import numpy as np

    buffer = io.BytesIO()
    wav_arr = np.array(wav, dtype=np.float32)
    scipy.io.wavfile.write(buffer, sample_rate, wav_arr)
    return buffer.getvalue()


def decode_source_audio_bytes(audio_bytes: bytes) -> str:
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_file.close()
    try:
        run_ffmpeg_decode(audio_bytes, tmp_file.name)
        return tmp_file.name
    except subprocess.CalledProcessError as exc:
        os.unlink(tmp_file.name)
        raise


tts: Optional[TTS] = None
model_ready: bool = False


def try_load_model() -> bool:
    """Try to load the TTS model. Returns True on success.
    This is the ONLY place model loading happens at runtime.
    The downloader Job is responsible for populating /models.
    """
    global tts, model_ready
    if model_ready and tts is not None:
        return True
    try:
        print(f"[samesame] Loading model {MODEL_NAME} from {TTS_MODEL_DIR} ...")
        tts = TTS(model_name=MODEL_NAME, progress_bar=False, gpu=False)
        model_ready = True
        print("[samesame] Model loaded successfully")
        return True
    except Exception as exc:
        print(f"[samesame] Model not ready yet (expected on first deploy): {exc}")
        model_ready = False
        tts = None
        return False


import threading
import time

@app.on_event("startup")
async def startup_event():
    # Load model in a background thread to prevent blocking the asyncio event loop.
    # This ensures liveness probes (/live) continue to respond during the slow model load.
    def load_loop():
        while not model_ready:
            try_load_model()
            if model_ready:
                break
            time.sleep(10)
            
    threading.Thread(target=load_loop, daemon=True).start()


@app.get("/health")
async def health():
    """Readiness probe target. Returns 503 until the TTS model is loaded by the downloader Job."""
    if model_ready and tts is not None:
        return {
            "status": "ok",
            "service": "samesame",
            "model": MODEL_NAME,
            "model_ready": True,
        }
    else:
        from starlette.responses import JSONResponse

        return JSONResponse(
            {
                "status": "downloading",
                "service": "samesame",
                "model": MODEL_NAME,
                "model_ready": False,
                "note": "waiting for downloader Job",
            },
            status_code=503,
        )


@app.get("/live")
async def live():
    """Liveness probe target. Always 200 as long as the process is running (even while downloading)."""
    return {"status": "alive", "service": "samesame"}


@app.post("/v1/clone")
def clone_voice(
    request: CloneRequest, authorization: Optional[str] = Header(None)
):
    if authorization is None or authorization.replace("Bearer ", "") != SAMESAME_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    if request.output_format not in {"wav", "ogg"}:
        raise HTTPException(
            status_code=400, detail="Unsupported output_format, use wav or ogg"
        )

    try:
        source_audio = base64.b64decode(request.source_audio_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {exc}")

    print(f"[samesame] Starting voice clone for text length {len(request.text)}...")
    clone_start = time.time()
    
    source_wav_path = None
    try:
        decode_start = time.time()
        source_wav_path = decode_source_audio_bytes(source_audio)
        print(f"[samesame] Source audio decoded in {time.time() - decode_start:.2f}s")

        if tts is None or not model_ready:
            # Trigger a lazy load attempt (in case the Job just finished)
            if not try_load_model():
                raise HTTPException(
                    status_code=503,
                    detail="SAMESAME model is still downloading (downloader Job not finished). Try again in a minute.",
                )

        lang = request.language or DEFAULT_LANGUAGE
        tts_kwargs = {"speaker_wav": source_wav_path, "language": lang}

        print(f"[samesame] Generating speech using Coqui TTS (language: {lang})...")
        tts_start = time.time()
        wav = tts.tts(request.text, **tts_kwargs)
        print(f"[samesame] Speech synthesis completed in {time.time() - tts_start:.2f}s")
        
        encode_start = time.time()
        wav_bytes = wav_bytes_from_numpy(wav, OUTPUT_SAMPLE_RATE)

        if request.output_format == "ogg":
            print("[samesame] Encoding output to OGG Opus...")
            response_bytes = run_ffmpeg_encode_wav_to_ogg(wav_bytes)
            media_type = "audio/ogg"
        else:
            response_bytes = wav_bytes
            media_type = "audio/wav"
        print(f"[samesame] Output encoded in {time.time() - encode_start:.2f}s")

        audio_base64 = base64.b64encode(response_bytes).decode("utf-8")
        print(f"[samesame] SUCCESS | model={MODEL_NAME} | format={request.output_format} | total_time={time.time() - clone_start:.2f}s", flush=True)
        
        return {"audio_base64": audio_base64, "content_type": media_type}

    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Audio decode failed: {exc.stderr.decode('utf-8', errors='ignore')}\n{exc}",
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice clone failed: {exc}")
    finally:
        if source_wav_path and os.path.exists(source_wav_path):
            os.unlink(source_wav_path)
