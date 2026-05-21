import base64
import io
import os
import subprocess
import tempfile
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from starlette.responses import StreamingResponse

# The TTS model will be downloaded into TTS_MODEL_DIR and loaded at startup.
from TTS.api import TTS

app = FastAPI(title="SAMESAME Voice Clone Service")

HUGGINGFACE_API_KEY = os.environ.get("HUGGINGFACE_API_KEY")
if HUGGINGFACE_API_KEY:
    os.environ.setdefault("HUGGINGFACE_API_KEY", HUGGINGFACE_API_KEY)
    os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", HUGGINGFACE_API_KEY)

HF_HOME = os.environ.get("HF_HOME", "/models")
os.environ.setdefault("HF_HOME", HF_HOME)
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")
if os.environ.get("SAMESAME_LOCAL_ONLY", "true").lower() in ("1", "true", "yes"):
    os.environ.setdefault("HF_LOCAL_FILES_ONLY", "true")

SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET", "changeme")
MODEL_NAME = os.environ.get("SAMESAME_MODEL_NAME", "tts_models/multilingual/multi-dataset/your_tts")
VOCODER_NAME = os.environ.get("SAMESAME_VOCODER_NAME", "vocoder_models/universal/libritts/fullband-melgan")
TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
OUTPUT_SAMPLE_RATE = int(os.environ.get("SAMESAME_SAMPLE_RATE", "22050"))

os.environ["TTS_MODEL_DIR"] = TTS_MODEL_DIR

class CloneRequest(BaseModel):
    source_audio_base64: str
    source_mime_type: str = "audio/ogg"
    text: str
    language: Optional[str] = None
    output_format: Optional[str] = "wav"


def run_ffmpeg_decode(input_bytes: bytes, output_path: str) -> None:
    subprocess.run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        "pipe:0",
        "-ar",
        str(OUTPUT_SAMPLE_RATE),
        "-ac",
        "1",
        output_path,
    ], input=input_bytes, check=True, capture_output=True)


def run_ffmpeg_encode_wav_to_ogg(wav_bytes: bytes) -> bytes:
    result = subprocess.run([
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "wav",
        "-i",
        "pipe:0",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        "-f",
        "ogg",
        "pipe:1",
    ], input=wav_bytes, check=True, capture_output=True)
    return result.stdout


def wav_bytes_from_numpy(wav: "np.ndarray", sample_rate: int) -> bytes:
    import soundfile as sf

    buffer = io.BytesIO()
    sf.write(buffer, wav, sample_rate, format="WAV")
    return buffer.getvalue()


def decode_source_audio_bytes(audio_bytes: bytes) -> str:
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    tmp_file.close()
    try:
        run_ffmpeg_decode(audio_bytes, tmp_file.name)
        return tmp_file.name
    except subprocess.CalledProcessError as exc:
        os.unlink(tmp_file.name)
        raise


tts: Optional[TTS] = None

@app.on_event("startup")
async def startup_event():
    global tts
    load_kwargs = {
        "model_name": MODEL_NAME,
        "progress_bar": False,
        "gpu": False,
    }
    if VOCODER_NAME:
        load_kwargs["vocoder_name"] = VOCODER_NAME

    try:
        tts = TTS(**load_kwargs)
    except TypeError:
        tts = TTS(model_name=MODEL_NAME, progress_bar=False, gpu=False)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "samesame", "model": MODEL_NAME, "vocoder": VOCODER_NAME}


@app.post("/v1/clone")
async def clone_voice(request: CloneRequest, authorization: Optional[str] = Header(None)):
    if authorization is None or authorization.replace("Bearer ", "") != SAMESAME_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    if request.output_format not in {"wav", "ogg"}:
        raise HTTPException(status_code=400, detail="Unsupported output_format, use wav or ogg")

    try:
        source_audio = base64.b64decode(request.source_audio_base64)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 audio: {exc}")

    source_wav_path = None
    try:
        source_wav_path = decode_source_audio_bytes(source_audio)

        if tts is None:
            raise RuntimeError("SAMESAME model not loaded")

        tts_kwargs = {"speaker_wav": source_wav_path}
        if request.language:
            tts_kwargs["language"] = request.language

        wav = tts.tts(request.text, **tts_kwargs)
        wav_bytes = wav_bytes_from_numpy(wav, OUTPUT_SAMPLE_RATE)

        if request.output_format == "ogg":
            response_bytes = run_ffmpeg_encode_wav_to_ogg(wav_bytes)
            media_type = "audio/ogg"
        else:
            response_bytes = wav_bytes
            media_type = "audio/wav"

        return StreamingResponse(io.BytesIO(response_bytes), media_type=media_type)

    except subprocess.CalledProcessError as exc:
        raise HTTPException(status_code=400, detail=f"Audio decode failed: {exc.stderr.decode('utf-8', errors='ignore')}\n{exc}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Voice clone failed: {exc}")
    finally:
        if source_wav_path and os.path.exists(source_wav_path):
            os.unlink(source_wav_path)
