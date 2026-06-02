import time
import base64
import os
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from funasr import AutoModel

app = FastAPI(title="FunASR MLT-Nano 2512 Service")

MODEL_NAME = os.getenv("FUNASR_MODEL", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")
MODEL_PATH = os.getenv("FUNASR_MODEL_PATH", None)
VAD_MODEL_PATH = os.getenv("FUNASR_VAD_MODEL_PATH", None)
PUNC_MODEL_PATH = os.getenv("FUNASR_PUNC_MODEL_PATH", None)
device = os.getenv("FUNASR_DEVICE", "cpu")
ncpu = int(os.getenv("FUNASR_NCPU", "4"))
 FunASR MLT-Nano supports: VAD, punctuation, ITN, sentence_timestamp, hotwords,
# speaker diarization (spk_model), multi-language, etc.
# We use the model's native capabilities for best quality:
# - VAD for long audio segmentation
# - Native punctuation (Fun-ASR-MLT-Nano outputs punctuated text)
# - ITN (inverse text normalization) for numbers, dates, etc.
# - Sentence-level timestamps for better UX
# - Hotwords support for domain-specific terms
# - Speaker diarization when spk_model is configured

automodel_kwargs = dict(
    model=MODEL_NAME,
    device=device,
    ncpu=ncpu,
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

# Apply torch.compile for faster CPU inference on supported models
try:
    if hasattr(funasr, 'model') and hasattr(funasr.model, 'model'):
        print(f"[funasr] Applying torch.compile() with ncpu={ncpu}...")
        funasr.model.model = torch.compile(funasr.model.model, mode="reduce-overhead")
        print("[funasr] torch.compile() applied successfully")
except Exception as e:
    print(f"[funasr] torch.compile() skipped: {e}")

# Ensure torch uses configured thread count
torch.set_num_threads(ncpu)
os.environ["OMP_NUM_THREADS"] = str(ncpu)
os.environ["MKL_NUM_THREADS"] = str(ncpu)

print(f"[funasr] Model loaded: {MODEL_NAME}, device={device}, ncpu={ncpu}")


@app.get("/ready")
def ready():
    try:
        if funasr and funasr.model:
            return {"ready": True, "model": MODEL_NAME}
    except Exception as e:
        return {"ready": False, "reason": str(e)}
    return {"ready": False, "reason": "Model not initialized"}


class TranscribeRequest(BaseModel):
    file_data: str
    mime_type: str = "audio/ogg"
    language: str = "auto"


@app.post("/v1/transcribe-base64")
async def transcribe(req: TranscribeRequest):
    import tempfile
    
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    # Determine file extension from mime type
    if "video" in req.mime_type:
        suffix = ".mp4"
    elif "wav" in req.mime_type:
        suffix = ".wav"
    elif "mp3" in req.mime_type:
        suffix = ".mp3"
    elif "flac" in req.mime_type:
        suffix = ".flac"
    else:
        suffix = ".ogg"

    fd_in = None
    path_in = None
    path_wav = None

    try:
        start_time = time.time()

        # Write input to temp file
        fd_in, path_in = tempfile.mkstemp(suffix=suffix)
        os.write(fd_in, file_bytes)
        os.close(fd_in)
        fd_in = None

        # Convert to WAV 16kHz mono for FunASR
        path_wav = path_in + ".wav"
        import subprocess
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", path_in,
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                path_wav
            ],
            capture_output=True,
            timeout=120,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"FFMPEG error: {result.stderr.decode()}")

        # FunASR offline inference with best quality settings
        generate_kwargs = dict(
            input=path_wav,
            language=req.language,
            use_itn=True,           # Inverse text normalization (numbers, dates, etc.)
            merge_vad=True,         # Merge VAD segments for coherent output
            batch_size_s=600,       # 10 min batches — fewer passes for long audio
        )
        result = funasr.generate(**generate_kwargs)

        # Parse result
        text = ""
        if isinstance(result, list) and len(result) > 0:
            first = result[0]
            if isinstance(first, dict):
                text = first.get("text", "")
            elif isinstance(first, str):
                text = first
        elif isinstance(result, dict):
            text = result.get("text", "")

        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "text": text,
            "model": MODEL_NAME,
            "latency_ms": latency_ms,
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="FFMPEG conversion timed out")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[funasr] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for p in [path_in, path_wav]:
            if p and os.path.exists(p):
                os.remove(p)
