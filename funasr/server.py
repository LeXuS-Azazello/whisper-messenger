import time
import base64
import os
import subprocess
import tempfile
import numpy as np
import torch
import soundfile as sf
from threading import Lock

NCPU = int(os.getenv("FUNASR_NCPU", "4"))
torch.set_num_threads(NCPU)
torch.set_num_interop_threads(1)
os.environ["OMP_WAIT_POLICY"] = "PASSIVE"
os.environ["KMP_BLOCKTIME"] = "0"

model_lock = Lock()

def decode_audio(file_bytes=None, file_path=None):
    """Decode audio either from raw bytes or from a file path.
    Supports wav, ogg, oga, etc. via soundfile, falling back to ffmpeg for raw bytes.
    Returns a NumPy float32 array at 16 kHz mono.
    """
    if file_path:
        try:
            audio, sr = sf.read(file_path, dtype='float32')
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            # Resample to 16 kHz if needed
            if sr != 16000:
                import torch
                import torchaudio.functional as F
                audio = torch.from_numpy(audio).float()
                audio = F.resample(audio, sr, 16000).numpy()
            return audio
        except Exception as e:
            raise RuntimeError(f"soundfile read failed: {e}")
    # Fallback – use ffmpeg on raw bytes
    cmd = [
        "ffmpeg",
        "-nostdin",
        "-hide_banner",
        "-loglevel", "error",
    ]
    if file_path:
        cmd.extend(["-i", file_path])
        input_data = None
    else:
        cmd.extend(["-i", "pipe:0"])
        input_data = file_bytes
    cmd.extend([
        "-ac", "1",
        "-ar", "16000",
        "-f", "f32le",
        "pipe:1",
    ])
    proc = subprocess.run(
        cmd,
        input=input_data,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    audio = np.frombuffer(proc.stdout, dtype=np.float32)
    if audio.size == 0:
        raise RuntimeError("empty audio")
    return audio

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "GET /health" in msg or "GET /live" in msg or "GET /ready" in msg:
            return False
        return True

app = FastAPI()

@app.on_event("startup")
def setup_logging():
    logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

# Set ModelScope cache before any funasr imports
os.environ["MODELSCOPE_CACHE"] = "/models"

# Ensure /models exists (volume might be empty)
os.makedirs("/models", exist_ok=True)
os.makedirs("/models/models", exist_ok=True)
os.makedirs("/models/hub", exist_ok=True)

# If model downloaded to /models/models/, create symlink to /models/hub/ for compatibility
models_src = "/models/models/FunAudioLLM/Fun-ASR-MLT-Nano-2512"
models_dst = "/models/hub/FunAudioLLM/Fun-ASR-MLT-Nano-2512"
if os.path.isdir(models_src) and not os.path.exists(models_dst):
    try:
        os.symlink(models_src, models_dst)
        print(f"[funasr] Created symlink {models_dst} -> {models_src}")
    except FileNotFoundError:
        pass  # Parent directory might not exist

# Same for VAD/Punc models
for src_p in ["/models/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch",
              "/models/models/iic/punc_ct-transformer_cn-en-common-vocab471067-large"]:
    dst_p = src_p.replace("/models/models/", "/models/hub/")
    if os.path.isdir(src_p) and not os.path.exists(dst_p):
        try:
            os.symlink(src_p, dst_p)
            print(f"[funasr] Created symlink {dst_p} -> {src_p}")
        except FileNotFoundError:
            pass

MODEL_NAME = os.getenv("FUNASR_MODEL", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")

# ModelScope may download to /models/models/ or /models/hub/ - check both
MODEL_PATH_CANDIDATES = [
    "/models/hub/FunAudioLLM/Fun-ASR-MLT-Nano-2512",
    "/models/models/FunAudioLLM/Fun-ASR-MLT-Nano-2512",
    "/models/FunAudioLLM/Fun-ASR-MLT-Nano-2512",
]
MODEL_PATH = os.getenv("FUNASR_MODEL_PATH", None)
if MODEL_PATH is None:
    for candidate in MODEL_PATH_CANDIDATES:
        if os.path.isdir(candidate):
            MODEL_PATH = candidate
            print(f"[funasr] Found model at {MODEL_PATH}")
            break
VAD_MODEL_PATH = os.getenv("FUNASR_VAD_MODEL_PATH", None)
if VAD_MODEL_PATH is None:
    for p in ["/models/hub/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch",
              "/models/models/iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"]:
        if os.path.isdir(p):
            VAD_MODEL_PATH = p
            print(f"[funasr] Found VAD model at {VAD_MODEL_PATH}")
            break

PUNC_MODEL_PATH = os.getenv("FUNASR_PUNC_MODEL_PATH", None)
if PUNC_MODEL_PATH is None:
    for p in ["/models/hub/iic/punc_ct-transformer_cn-en-common-vocab471067-large",
              "/models/models/iic/punc_ct-transformer_cn-en-common-vocab471067-large"]:
        if os.path.isdir(p):
            PUNC_MODEL_PATH = p
            print(f"[funasr] Found PUNC model at {PUNC_MODEL_PATH}")
            break

device = os.getenv("FUNASR_DEVICE", "cpu")

# Wait for models to be present on disk (downloaded by Job)
_model_ready = False
if MODEL_PATH and os.path.isdir(MODEL_PATH):
    _model_ready = True
    print(f"[funasr] Model found at {MODEL_PATH}")
else:
    raise RuntimeError(f"model missing at {MODEL_PATH}")

from funasr import AutoModel

automodel_kwargs = dict(
    model=MODEL_NAME,
    device=device,
    disable_update=True,
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 30000},
    punc_model="ct-punc",
    hub="ms",
)
if MODEL_PATH and os.path.isdir(MODEL_PATH):
    automodel_kwargs["model_path"] = MODEL_PATH
if VAD_MODEL_PATH and os.path.isdir(VAD_MODEL_PATH):
    automodel_kwargs["vad_model"] = VAD_MODEL_PATH
if PUNC_MODEL_PATH and os.path.isdir(PUNC_MODEL_PATH):
    automodel_kwargs["punc_model"] = PUNC_MODEL_PATH

funasr = AutoModel(**automodel_kwargs)

print(f"[funasr] Model loaded: {MODEL_NAME}, device={device}")

# Warmup for faster first request
try:
    dummy = np.zeros(16000 * 3, dtype=np.float32)
    with model_lock:
        funasr.generate(
            input=dummy,
            language="auto",
            batch_size_s=15
        )
    print("[funasr] warmup done")
except Exception as e:
    print(f"[funasr] warmup skipped: {e}")


@app.get("/ready")
def ready():
    try:
        if funasr and funasr.model:
            return {"ready": True}
    except Exception as e:
        return {"ready": False, "reason": str(e)}
    return {"ready": False, "reason": "Model not initialized"}


from pydantic import BaseModel, model_validator
from typing import Optional

class TranscribeRequest(BaseModel):
    file_data: Optional[str] = None
    file_path: Optional[str] = None
    mime_type: str = "audio/ogg"
    language: str = "auto"
    enable_vad: bool = True
    enable_punc: bool = True

    @model_validator(mode='after')
    def check_file_input(self):
        if not self.file_data and not self.file_path:
            raise ValueError('Either file_data (base64) or file_path must be provided.')
        return self


@app.post("/v1/transcribe-base64")
async def transcribe(req: TranscribeRequest):
    try:
        t0 = time.time()

        if req.file_path and os.path.isfile(req.file_path):
            audio_np = decode_audio(file_path=req.file_path)
        elif req.file_data:
            file_bytes = base64.b64decode(req.file_data)
            audio_np = decode_audio(file_bytes=file_bytes)
        else:
            raise HTTPException(status_code=400, detail="Missing file_data or file_path")
        
        t_decode = time.time()

        generate_kwargs = {
            "input": audio_np,
            "language": req.language,
            "use_itn": True,
            "batch_size_s": 15,
        }
        
        if req.enable_vad:
            generate_kwargs["merge_vad"] = True
        else:
            generate_kwargs["vad_model"] = None
            generate_kwargs["merge_vad"] = False
            
        if not req.enable_punc:
            generate_kwargs["punc_model"] = None

        with model_lock:
            result_list = funasr.generate(**generate_kwargs)

        t_model = time.time()

        text = ""
        detected_lang = None
        if isinstance(result_list, list) and len(result_list) > 0:
            first = result_list[0]
            if isinstance(first, dict):
                text = first.get("text", "")
                raw_lang = first.get("language") or first.get("lang") or ""
                if raw_lang:
                    detected_lang = raw_lang[:2].lower()
            elif isinstance(first, str):
                text = first
        elif isinstance(result_list, dict):
            text = result_list.get("text", "")
            raw_lang = result_list.get("language") or result_list.get("lang") or ""
            if raw_lang:
                detected_lang = raw_lang[:2].lower()

        return {
            "text": text,
            "language": detected_lang,
            "model": MODEL_NAME,
            "decode_ms": int((t_decode - t0) * 1000),
            "infer_ms": int((t_model - t_decode) * 1000),
            "latency_ms": int((t_model - t0) * 1000)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[funasr] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
