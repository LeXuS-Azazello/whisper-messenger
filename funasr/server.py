import asyncio
import base64
import os
import time
import numpy as np
import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from funasr import AutoModel

# Оптимизация потоков Torch под K8s Limits (cpu limits: "4")
CPU_CORES = int(os.getenv("FUNASR_NCPU", "4"))
torch.set_num_threads(CPU_CORES)
torch.set_num_interop_threads(CPU_CORES)

app = FastAPI(title="FunASR MLT-Nano 2512 Optimized Service")

MODEL_NAME = os.getenv("FUNASR_MODEL", "FunAudioLLM/Fun-ASR-MLT-Nano-2512")
MODEL_PATH = os.getenv("FUNASR_MODEL_PATH", None)
VAD_MODEL_PATH = os.getenv("FUNASR_VAD_MODEL_PATH", None)
PUNC_MODEL_PATH = os.getenv("FUNASR_PUNC_MODEL_PATH", None)
device = os.getenv("FUNASR_DEVICE", "cpu")

automodel_kwargs = dict(
    model=MODEL_NAME,
    device=device,
    disable_update=True,
    hub="ms",
    ncpu=CPU_CORES,  # Передаем количество ядер в модель
)

# Подгрузка локальных путей, если они есть
if MODEL_PATH and os.path.isdir(MODEL_PATH):
    automodel_kwargs["model"] = MODEL_PATH  # В FunASR локальный путь часто передается прямо в model
if VAD_MODEL_PATH and os.path.isdir(VAD_MODEL_PATH):
    automodel_kwargs["vad_model"] = VAD_MODEL_PATH
else:
    automodel_kwargs["vad_model"] = "fsmn-vad"
    automodel_kwargs["vad_kwargs"] = {"max_single_segment_time": 30000}

if PUNC_MODEL_PATH and os.path.isdir(PUNC_MODEL_PATH):
    automodel_kwargs["punc_model"] = PUNC_MODEL_PATH
else:
    automodel_kwargs["punc_model"] = "ct-punc"

funasr = AutoModel(**automodel_kwargs)


@app.get("/ready")
def ready():
    return {"ready": funasr is not None}


class TranscribeRequest(BaseModel):
    file_data: str
    mime_type: str = "audio/ogg"
    language: str = "auto"


def _run_inference(audio_np: np.ndarray, language: str):
    """Синхронная функция инференса для запуска в ThreadPool."""
    # FunASR принимает numpy-массив (float32) и частоту дискретизации
    return funasr.generate(input=audio_np, data_type="sound", language=language)


@app.post("/v1/transcribe-base64")
async def transcribe(req: TranscribeRequest):
    try:
        file_bytes = base64.b64decode(req.file_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 data")

    start_time = time.time()

    # 1. Асинхронный ffmpeg через PIPE (In-Memory)
    # Конвертируем входной поток в PCM 16-bit float или int16, 16000Hz, 1 канал
    process = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-i", "pipe:0",
        "-f", "s16le", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.DEVNULL
    )

    try:
        # Передаем байты в stdin и ждем ответа из stdout
        stdout_data, _ = await process.communicate(input=file_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FFMPEG streaming failed: {str(e)}")

    if process.returncode != 0:
        raise HTTPException(status_code=500, detail="FFMPEG extraction failed")

    # 2. Превращаем байты из stdout в numpy массив, который ожидает FunASR
    # Для pcm_s16le это int16. Переводим в float32 и нормализуем (деление на 32768)
    audio_data = np.frombuffer(stdout_data, dtype=np.int16).astype(np.float32) / 32768.0

    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio data after processing")

    # 3. Выносим тяжелый инференс в отдельный поток, чтобы не блокировать Event Loop
    loop = asyncio.get_running_loop()
    try:
        result = await loop.run_in_executor(None, _run_inference, audio_data, req.language)
    except Exception as e:
        print(f"[funasr] ML Inference Error: {e}")
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")

    # Разбор ответа
    text = ""
    if isinstance(result, list) and len(result) > 0:
        first_item = result[0]
        text = first_item.get("text", "") if isinstance(first_item, dict) else str(first_item)
    elif isinstance(result, dict):
        text = result.get("text", "")

    latency_ms = int((time.time() - start_time) * 1000)
    return {"text": text, "model": MODEL_NAME, "latency_ms": latency_ms}
