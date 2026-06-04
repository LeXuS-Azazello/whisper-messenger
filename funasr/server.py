import time
import base64
import os
import subprocess
import tempfile

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

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
    print(f"[funasr] Model not found at {MODEL_PATH}, waiting...")
    for i in range(60):
        time.sleep(5)
        if MODEL_PATH and os.path.isdir(MODEL_PATH):
            _model_ready = True
            print(f"[funasr] Model appeared at {MODEL_PATH} after {i*5}s")
            break
    if not _model_ready:
        print(f"[funasr] WARNING: Model still not found, AutoModel will attempt download")

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
    funasr.generate(
        input=dummy,
        language="auto",
        batch_size_s=60
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


class TranscribeRequest(BaseModel):
    file_data: str
    mime_type: str = "audio/ogg"
    language: str = "auto"


@app.post("/v1/transcribe-base64")
async def transcribe(req: TranscribeRequest):
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    try:
        start_time = time.time()

        audio_stream = io.BytesIO(file_bytes)
        waveform, sr = sf.read(audio_stream, dtype="float32")

        if waveform.ndim > 1:
            waveform = waveform.mean(axis=1)

        audio = torch.from_numpy(waveform)

        if sr != 16000:
            audio = F.resample(audio, sr, 16000)

        audio_np = audio.numpy()

        generate_kwargs = dict(
            input=audio_np,
            language=req.language,
            use_itn=True,
            merge_vad=True,
            batch_size_s=60,
        )
        result_list = funasr.generate(**generate_kwargs)

        text = ""
        if isinstance(result_list, list) and len(result_list) > 0:
            first = result_list[0]
            if isinstance(first, dict):
                text = first.get("text", "")
            elif isinstance(first, str):
                text = first
        elif isinstance(result_list, dict):
            text = result_list.get("text", "")

        latency_ms = int((time.time() - start_time) * 1000)
        return {"text": text, "model": MODEL_NAME, "latency_ms": latency_ms}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[funasr] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
