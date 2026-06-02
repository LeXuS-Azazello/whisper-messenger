import time
import base64
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from funasr import AutoModel
import torch

app = FastAPI(title="FunASR MLT-Nano 2512 Service")

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

# Try to compile model for faster CPU inference
try:
    if hasattr(funasr, 'model') and hasattr(funasr.model, 'model'):
        print("[funasr] Applying torch.compile() for CPU acceleration...")
        funasr.model.model = torch.compile(funasr.model.model, mode="reduce-overhead")
        print("[funasr] torch.compile() applied successfully")
except Exception as e:
    print(f"[funasr] torch.compile() skipped: {e}")

@app.get("/ready")
def ready():
    try:
        if funasr:
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
    import tempfile, subprocess
    
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    suffix = ".mp4" if "video" in req.mime_type else ".ogg"
    fd_in, path_in = tempfile.mkstemp(suffix=suffix)
    os.write(fd_in, file_bytes)
    os.close(fd_in)
    path_wav = path_in + ".wav"

    try:
        start_time = time.time()

        # Convert to WAV 16kHz mono
        subprocess.run([
            "ffmpeg", "-y", "-i", path_in,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            path_wav
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        # Offline ASR: process entire audio in one go, maximize batch size
        generate_kwargs = dict(
            input=path_wav,
            language=req.language,
            use_itn=True,
            merge_vad=True,
            batch_size_s=600,       # 10 min per batch — process longer audio in fewer passes
        )
        result = funasr.generate(**generate_kwargs)

        if isinstance(result, list):
            if len(result) > 0:
                first_item = result[0]
                if isinstance(first_item, dict):
                    text = first_item.get("text", "")
                elif isinstance(first_item, str):
                    text = first_item
                else:
                    text = str(first_item)
            else:
                text = ""
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = str(result) if result else ""

        latency_ms = int((time.time() - start_time) * 1000)
        return {"text": text, "model": MODEL_NAME, "latency_ms": latency_ms}
    except subprocess.CalledProcessError as e:
        print(f"[funasr] FFMPEG Error: {e}")
        raise HTTPException(status_code=500, detail="Audio extraction failed")
    except Exception as e:
        print(f"[funasr] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(path_in): os.remove(path_in)
        if os.path.exists(path_wav): os.remove(path_wav)
