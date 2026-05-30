import time
import base64
import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from funasr import AutoModel
from funasr.tokenizer import AutoTokenizer

app = FastAPI(title="FunASR MLT-Nano 2512 Service")

MODEL_NAME = os.getenv("FUNASR_MODEL", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")
MODEL_PATH = os.getenv("FUNASR_MODEL_PATH", None)
device = os.getenv("FUNASR_DEVICE", "cpu")

funasr = AutoModel(
    model=MODEL_PATH if MODEL_PATH else MODEL_NAME,
    device=device,
    vad_model="fsmn-vad",
    vad_kwargs={"max_single_segment_time": 30000},
    punc_model="ct transformer",
    hub="ms"
)

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

    import tempfile, subprocess

    suffix = ".mp4" if "video" in req.mime_type else ".ogg"
    fd_in, path_in = tempfile.mkstemp(suffix=suffix)
    os.write(fd_in, file_bytes)
    os.close(fd_in)
    path_wav = path_in + ".wav"

    try:
        start_time = time.time()

        print(f"[funasr] Processing {req.mime_type} file via ffmpeg...")
        subprocess.run([
            "ffmpeg", "-y", "-i", path_in,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            path_wav
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        result = funasr.generate(input=path_wav, language=req.language)

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
