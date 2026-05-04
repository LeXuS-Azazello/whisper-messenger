import os
import sys
import torch
from fastapi import FastAPI, UploadFile, File, Form, Header
from qwen_asr.inference import Qwen3ASR
import uvicorn
import shutil
import time

app = FastAPI()

model_name = os.getenv("MODEL_NAME", "Qwen/Qwen3-ASR-0.6B")
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading model {model_name} on {device}...")

# Load model
try:
    model = Qwen3ASR(model_name, device=device)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    sys.exit(1)

@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...), 
    model: str = Form("qwen3-asr"),
    authorization: str = Header(None)
):
    # Simple check for internal secret if needed, but for now we just log it
    # print(f"Transcribing with auth: {authorization}")
    
    start_time = time.time()
    temp_file = f"temp_{int(start_time)}_{file.filename}"
    with open(temp_file, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        print(f"Transcribing {temp_file}...")
        result = model.transcribe(temp_file)
        
        # Qwen3-ASR result is usually a dict or string
        if isinstance(result, str):
            text = result
        elif isinstance(result, dict):
            text = result.get("text", "")
        else:
            text = str(result)
            
        print(f"Transcription complete in {time.time() - start_time:.2f}s")
        return {"text": text}
    except Exception as e:
        print(f"Transcription error: {e}")
        return {"error": str(e)}, 500
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.get("/v1/models")
async def list_models():
    return {"data": [{"id": "qwen3-asr"}]}

@app.get("/health")
async def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=11434)
