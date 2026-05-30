import time
import base64
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from funasr import FunASR

app = FastAPI(title="FunASR Nano 2512 Service")

MODEL_NAME = os.getenv("FUNASR_MODEL", "funasr-nano-2512")

# Initialize FunASR model (loads on first request)
funasr = FunASR(MODEL_NAME)

class TranscribeRequest(BaseModel):
    file_data: str  # base64-encoded audio or video
    mime_type: str = "audio/ogg"

@app.post("/v1/transcribe-base64")
async def transcribe(req: TranscribeRequest):
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    import tempfile, os, subprocess
    
    # Determine extension based on mime type
    suffix = ".mp4" if "video" in req.mime_type else ".ogg"
    
    fd_in, path_in = tempfile.mkstemp(suffix=suffix)
    os.write(fd_in, file_bytes)
    os.close(fd_in)

    path_wav = path_in + ".wav"

    try:
        start_time = time.time()
        
        # Always use ffmpeg to extract and normalize audio to 16kHz WAV for FunASR
        # This seamlessly handles both voice messages (.ogg) and video notes (.mp4)
        print(f"[funasr] Processing {req.mime_type} file via ffmpeg...")
        subprocess.run([
            "ffmpeg", "-y", "-i", path_in,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            path_wav
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)

        result = funasr.generate(path_wav)
        
        # FunASR generate() often returns a list of dicts.
        if isinstance(result, list) and len(result) > 0:
            text = result[0].get("text", "")
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = ""

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
