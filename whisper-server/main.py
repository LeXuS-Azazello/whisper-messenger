import io
import os
import wave
import numpy as np
from fastapi import FastAPI, UploadFile, File, Header, HTTPException
import sherpa_onnx
import uvicorn
import subprocess

app = FastAPI()

# Configuration
MODEL_DIR = os.getenv("MODEL_DIR", "/app/models/whisper-tiny")
num_threads = int(os.getenv("NUM_THREADS", "4"))
SECRET = os.getenv("WHISPER_SECRET", "changeme")

# Initialize recognizer
def create_recognizer():
    # Find the model files
    int8_encoder = None
    int8_decoder = None
    fp32_encoder = None
    fp32_decoder = None
    tokens = ""
    
    for f in os.listdir(MODEL_DIR):
        if f.endswith("encoder.int8.onnx"):
            int8_encoder = os.path.join(MODEL_DIR, f)
        elif f.endswith("encoder.onnx") and not f.endswith(".int8.onnx"):
            fp32_encoder = os.path.join(MODEL_DIR, f)
        elif f.endswith("decoder.int8.onnx"):
            int8_decoder = os.path.join(MODEL_DIR, f)
        elif f.endswith("decoder.onnx") and not f.endswith(".int8.onnx"):
            fp32_decoder = os.path.join(MODEL_DIR, f)
        elif f.endswith("tokens.txt"):
            tokens = os.path.join(MODEL_DIR, f)
            
    if int8_encoder and int8_decoder:
        encoder = int8_encoder
        decoder = int8_decoder
    elif fp32_encoder and fp32_decoder:
        encoder = fp32_encoder
        decoder = fp32_decoder
    else:
        encoder = None
        decoder = None

    if not encoder or not decoder or not tokens:
        print(f"Directory {MODEL_DIR} contains: {os.listdir(MODEL_DIR)}")
        raise RuntimeError(f"Missing model files in {MODEL_DIR}")

    return sherpa_onnx.OfflineRecognizer.from_whisper(
        encoder=encoder,
        decoder=decoder,
        tokens=tokens,
        num_threads=num_threads,
        language="", # auto detect
        task="transcribe",
    )

recognizer = create_recognizer()

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    x_whisper_secret: str = Header(None)
):
    if x_whisper_secret != SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
        
    audio_bytes = await file.read()
    
    # Convert to 16kHz mono PCM using ffmpeg
    with subprocess.Popen(
        ["ffmpeg", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", "16000", "pipe:1"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    ) as process:
        stdout, stderr = process.communicate(input=audio_bytes)
        if process.returncode != 0:
            error_msg = stderr.decode() if isinstance(stderr, bytes) else str(stderr)
            raise HTTPException(status_code=500, detail=f"FFmpeg error: {error_msg}")
        
    samples = np.frombuffer(stdout, dtype=np.int16).astype(np.float32) / 32768.0
    
    stream = recognizer.create_stream()
    stream.accept_waveform(16000, samples)
    recognizer.decode_stream(stream)
    
    return {"text": stream.result.text}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
