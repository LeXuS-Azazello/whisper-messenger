import time
import base64
import os
import subprocess
import tempfile

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="FunASR Service")

from funasr import AutoModel

MODEL_NAME = os.getenv("FUNASR_MODEL", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")
MODEL_PATH = os.getenv("FUNASR_MODEL_PATH", None)
VAD_MODEL_PATH = os.getenv("FUNASR_VAD_MODEL_PATH", None)
PUNC_MODEL_PATH = os.getenv("FUNASR_PUNC_MODEL_PATH", None)
device = os.getenv("FUNASR_DEVICE", "cpu")

automodel_kwargs = dict(
    model=MODEL_NAME,
    device=device,
    disable_update=True,
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 60000},
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

# torch.compile for faster CPU inference
try:
    if hasattr(funasr, 'model') and hasattr(funasr.model, 'model'):
        import torch
        funasr.model.model = torch.compile(funasr.model.model, mode="reduce-overhead")
        print("[funasr] torch.compile() applied")
except Exception as e:
    print(f"[funasr] torch.compile() skipped: {e}")

print(f"[funasr] Model loaded: {MODEL_NAME}, device={device}")


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

    if "video" in req.mime_type:
        suffix = ".mp4"
    elif "wav" in req.mime_type:
        suffix = ".wav"
    elif "mp3" in req.mime_type:
        suffix = ".mp3"
    else:
        suffix = ".ogg"

    try:
        start_time = time.time()

        fd_in, path_in = tempfile.mkstemp(suffix=suffix)
        os.write(fd_in, file_bytes)
        os.close(fd_in)

        path_wav = path_in + ".wav"
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", path_in,
             "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
             path_wav],
            capture_output=True, timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail="Audio conversion failed")

        generate_kwargs = dict(
            input=path_wav,
            language=req.language,
            use_itn=True,
            merge_vad=True,
            batch_size_s=600,
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
    finally:
        for p in [path_in, path_wav]:
            if p and os.path.exists(p):
                os.remove(p)
