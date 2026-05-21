import io
import os
import torch
import uvicorn
import subprocess
import numpy as np
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from torch.nn.attention import SDPBackend, sdpa_kernel

app = FastAPI()

device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32
if device == "cpu":
    torch.set_num_threads(16)
model_id = "openai/whisper-large-v3-turbo"

# Prefer the PVC-backed cache dir; fall back to default if not set.
_HF_HOME = os.environ.get("HF_HOME", os.path.expanduser("~/.cache/huggingface"))
os.environ.setdefault("HF_HOME", _HF_HOME)

# Ensure we only use locally cached files at runtime — the model cache is
# backed by the PVC (/hf-cache) and HF_HUB_TOKEN is set for auth on first pull.
_local_only = os.environ.get("HF_LOCAL_FILES_ONLY", "false").lower() in ("true", "1")

print(f"Loading Whisper Turbo model on {device}...")
try:
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id,
        torch_dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
        local_files_only=_local_only,
        cache_dir=_HF_HOME,
    ).to(device)

    model.generation_config.cache_implementation = "static"
    model.generation_config.max_new_tokens = 256
    # model.forward = torch.compile(model.forward, mode="reduce-overhead", fullgraph=True)

    processor = AutoProcessor.from_pretrained(
        model_id,
        local_files_only=_local_only,
        cache_dir=_HF_HOME,
    )

    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
        chunk_length_s=30,
        batch_size=4,
    )
    print("Model loaded successfully!")
except Exception as e:
    print(f"FATAL: Failed to load model: {e}")
    import sys
    sys.exit(1)

def split_text_into_chunks(text, limit=3900):
    if not text:
        return []
    if len(text) <= limit:
        return [text]
    chunks = []
    while len(text) > limit:
        chunks.append(text[:limit])
        text = text[limit:]
    if text:
        chunks.append(text)
    return chunks


def decode_audio_file_to_pcm(file_path: str) -> np.ndarray:
    result = subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
        '-i', file_path,
        '-vn', '-ar', '16000', '-ac', '1',
        '-f', 'f32le', 'pipe:1'
    ], check=True, capture_output=True)
    return np.frombuffer(result.stdout, dtype=np.float32)


def decode_audio_bytes_to_pcm(audio_bytes: bytes) -> np.ndarray:
    result = subprocess.run([
        'ffmpeg', '-hide_banner', '-loglevel', 'error',
        '-i', 'pipe:0',
        '-vn', '-ar', '16000', '-ac', '1',
        '-f', 'f32le', 'pipe:1'
    ], input=audio_bytes, check=True, capture_output=True)
    return np.frombuffer(result.stdout, dtype=np.float32)


def delete_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False

@app.get("/health")
async def health():
    return {"status": "ok", "model": model_id, "device": device}

class TranscribePathRequest(BaseModel):
    file_path: str
    mime_type: str
    language: str = "auto"

@app.post("/v1/transcribe-path")
async def transcribe_path(body: TranscribePathRequest):
    file_path = body.file_path
    mime_type = body.mime_type
    language = body.language

    if not os.path.exists(file_path):
        return {"error": f"File not found: {file_path}", "text": ""}

    import asyncio
    loop = asyncio.get_event_loop()

    def process():
        try:
            generate_kwargs = {"max_new_tokens": 444}
            if language and language != "auto":
                generate_kwargs["language"] = language

            if mime_type.startswith("video/") or any(file_path.lower().endswith(ext) for ext in ['.mp4', '.mkv', '.mov', '.avi']):
                audio_array = decode_audio_file_to_pcm(file_path)
                result = pipe(audio_array, sampling_rate=16000, generate_kwargs=generate_kwargs)
            else:
                result = pipe(file_path, generate_kwargs=generate_kwargs)

            text = result.get("text", "")
            chunks = split_text_into_chunks(text)
            print(f"Transcription success: {text[:50]}...")
            return {"text": "\n".join(chunks), "chunks": chunks}
        except Exception as e:
            print(f"Error transcribing: {e}")
            return {"error": str(e), "text": ""}

    return await loop.run_in_executor(None, process)

class DeleteFileRequest(BaseModel):
    file_path: str

@app.post("/v1/delete-file")
async def delete_file_endpoint(body: DeleteFileRequest):
    deleted = delete_file(body.file_path)
    return {"deleted": deleted, "path": body.file_path}

import base64

class TranscribeBase64Request(BaseModel):
    file_data: str
    mime_type: str
    language: str = "auto"

@app.post("/v1/transcribe-base64")
async def transcribe_base64(body: TranscribeBase64Request):
    print("Received base64 transcription request")
    
    import asyncio
    loop = asyncio.get_event_loop()
    
    def process_base64():
        try:
            content = base64.b64decode(body.file_data)
        except Exception as e:
            return {"error": f"Invalid base64: {e}", "text": ""}

        try:
            audio_array = decode_audio_bytes_to_pcm(content)
            generate_kwargs = {"max_new_tokens": 444}
            if body.language and body.language != "auto":
                generate_kwargs["language"] = body.language

            with sdpa_kernel(SDPBackend.MATH):
                result = pipe(audio_array, sampling_rate=16000, generate_kwargs=generate_kwargs)

            text = result.get("text", "")
            chunks = split_text_into_chunks(text)
            print(f"Transcription success: {text[:50]}...")
            return {"text": "\n".join(chunks), "chunks": chunks}
        except Exception as e:
            print(f"Error transcribing base64: {e}")
            return {"error": str(e), "text": ""}

    return await loop.run_in_executor(None, process_base64)


@app.post("/v1/audio/transcriptions")
async def transcribe(
    file: UploadFile = File(...),
    model_name: str = Form(default="openai/whisper-large-v3-turbo"),
    language: str = Form(default="auto"),
    task: str = Form(default="transcribe")
):
    print(f"Received transcription request: {file.filename}")
    content = await file.read()

    import asyncio
    loop = asyncio.get_event_loop()

    def process_audio():
        try:
            audio_array = decode_audio_bytes_to_pcm(content)
            generate_kwargs = {
                "task": task,
                "max_new_tokens": 444,
            }
            if language and language != "auto":
                generate_kwargs["language"] = language

            with sdpa_kernel(SDPBackend.MATH):
                result = pipe(audio_array, sampling_rate=16000, generate_kwargs=generate_kwargs)

            text = result.get("text", "")
            chunks = split_text_into_chunks(text)
            print(f"Transcription success: {text[:50]}...")
            return chunks
        except Exception as e:
            print(f"Error transcribing: {e}")
            return []

    chunks = await loop.run_in_executor(None, process_audio)
    return {"text": "\n".join(chunks), "chunks": chunks}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
