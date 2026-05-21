"""
Вариант A: faster-whisper FastAPI сервис
Совместим с текущим API клиентов — замена без изменения клиентского кода.

Ключевые улучшения vs текущего:
  - CTranslate2 backend вместо PyTorch (3-5x быстрее на CPU)
  - INT8 квантизация (модель занимает в 4x меньше памяти)
  - vad_filter=True — встроенная фильтрация тишины
  - num_workers=4 — параллельная обработка
  - Опциональный перевод через translation-service (NLLB-200, 200 языков)

Добавить перевод: передать "target_language": "eng_Latn" в запросе
"""

import os
import base64
import tempfile
import subprocess
import urllib.request
import json
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from faster_whisper import WhisperModel

app = FastAPI(title="Whisper Service v2 (faster-whisper)")

MODEL_SIZE        = os.environ.get("MODEL_SIZE", "large-v3-turbo")
DEVICE            = os.environ.get("DEVICE", "cpu")
COMPUTE           = os.environ.get("COMPUTE_TYPE", "int8")
NUM_WORKERS       = int(os.environ.get("NUM_WORKERS", "4"))
CACHE_DIR         = os.environ.get("HF_HOME", "/hf-cache")
TRANSLATE_URL     = os.environ.get(
    "TRANSLATE_SERVICE_URL",
    "http://translation-service.debugging-testcrash-pub.svc.cluster.local:8001/v1/translate"
)

# Маппинг ISO-639-1 → NLLB коды (faster-whisper возвращает короткие коды)
ISO_TO_NLLB = {
    "ru": "rus_Cyrl", "en": "eng_Latn", "zh": "zho_Hans", "de": "deu_Latn",
    "fr": "fra_Latn", "es": "spa_Latn", "uk": "ukr_Cyrl", "ar": "arb_Arab",
    "ja": "jpn_Jpan", "ko": "kor_Hang", "it": "ita_Latn", "pt": "por_Latn",
    "pl": "pol_Latn", "tr": "tur_Tglg", "nl": "nld_Latn", "vi": "vie_Latn",
    "th": "tha_Thai", "he": "heb_Hebr", "hi": "hin_Deva", "id": "ind_Latn",
}

print(f"[whisper-v2] Loading {MODEL_SIZE} ({COMPUTE}) on {DEVICE} with {NUM_WORKERS} workers...")
model = WhisperModel(
    MODEL_SIZE,
    device=DEVICE,
    compute_type=COMPUTE,
    num_workers=NUM_WORKERS,
    download_root=CACHE_DIR,
)
print("[whisper-v2] Model loaded!")


def to_wav_16k(src: str) -> str:
    """Конвертирует любой аудио/видео файл в WAV 16kHz mono через ffmpeg."""
    dst = src.rsplit(".", 1)[0] + "_16k.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-i", src,
         "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", dst],
        check=True, capture_output=True
    )
    return dst


def transcribe(file_path: str, language: str = "auto", task: str = "transcribe") -> dict:
    """Запускает faster-whisper inference и возвращает текст."""
    lang = None if language == "auto" else language

    segments, info = model.transcribe(
        file_path,
        language=lang,
        task=task,
        vad_filter=True,               # убирает тишину и паузы
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=5,
        best_of=5,
    )

    text = " ".join(seg.text.strip() for seg in segments).strip()
    detected_lang = info.language
    print(f"[whisper-v2] Detected: {detected_lang} | Text: {text[:60]}...")
    return {"text": text, "language": detected_lang}


def call_translation(text: str, detected_lang: str, target_lang: str) -> str:
    """Вызывает translation-service для перевода текста."""
    if not text or not target_lang:
        return text
    src_nllb = ISO_TO_NLLB.get(detected_lang, detected_lang)
    try:
        payload = json.dumps({
            "text": text,
            "source_lang": src_nllb,
            "target_lang": target_lang,
        }).encode()
        req = urllib.request.Request(
            TRANSLATE_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data.get("text", text)
    except Exception as e:
        print(f"[whisper-v2] Translation failed: {e}")
        return text  # fallback — оригинал


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_SIZE, "device": DEVICE, "compute": COMPUTE,
            "translate_url": TRANSLATE_URL}


# ── Base64 endpoint (используется facebook/whatsapp/instagram клиентами) ──────

class TranscribeBase64Request(BaseModel):
    file_data: str
    mime_type: str
    language: str = "auto"
    task: str = "transcribe"
    target_language: Optional[str] = None   # напр. "eng_Latn" — включает перевод

@app.post("/v1/transcribe-base64")
async def transcribe_base64(body: TranscribeBase64Request):
    import asyncio
    loop = asyncio.get_event_loop()

    def process():
        try:
            content = base64.b64decode(body.file_data)
        except Exception as e:
            return {"error": f"Invalid base64: {e}", "text": ""}

        ext = ".ogg" if "ogg" in body.mime_type else (
              ".mp4" if "mp4" in body.mime_type else ".wav")
        wav_path = None
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            wav_path = to_wav_16k(tmp_path)
            result = transcribe(wav_path, body.language, body.task)
            original_text = result["text"]
            detected_lang = result.get("language", "auto")

            response = {
                "text": original_text,
                "chunks": [original_text] if original_text else [],
                "language": detected_lang,
            }

            # Опциональный перевод
            if body.target_language and original_text:
                translated = call_translation(original_text, detected_lang, body.target_language)
                response["translated"] = translated
                response["target_language"] = body.target_language

            return response
        except Exception as e:
            print(f"[whisper-v2] Error: {e}")
            return {"error": str(e), "text": ""}
        finally:
            for p in [tmp_path, wav_path]:
                if p and os.path.exists(p):
                    os.remove(p)

    return await loop.run_in_executor(None, process)


# ── Multipart upload endpoint (совместимость с OpenAI API) ────────────────────

@app.post("/v1/audio/transcriptions")
async def transcribe_upload(
    file: UploadFile = File(...),
    model_name: str = Form(default="whisper-large-v3-turbo"),
    language: str = Form(default="auto"),
    task: str = Form(default="transcribe"),
):
    import asyncio
    content = await file.read()
    loop = asyncio.get_event_loop()

    def process():
        ext = os.path.splitext(file.filename)[1] or ".wav"
        wav_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            wav_path = to_wav_16k(tmp_path)
            result = transcribe(wav_path, language, task)
            return {"text": result["text"]}
        except Exception as e:
            return {"error": str(e), "text": ""}
        finally:
            for p in [tmp_path, wav_path]:
                if p and os.path.exists(p):
                    os.remove(p)

    return await loop.run_in_executor(None, process)


# ── Path endpoint ─────────────────────────────────────────────────────────────

class TranscribePathRequest(BaseModel):
    file_path: str
    mime_type: str
    language: str = "auto"
    task: str = "transcribe"
    target_language: Optional[str] = None

@app.post("/v1/transcribe-path")
async def transcribe_path(body: TranscribePathRequest):
    import asyncio
    loop = asyncio.get_event_loop()

    def process():
        if not os.path.exists(body.file_path):
            return {"error": f"File not found: {body.file_path}", "text": ""}
        wav_path = None
        try:
            wav_path = to_wav_16k(body.file_path)
            result = transcribe(wav_path, body.language, body.task)
            original_text = result["text"]
            detected_lang = result.get("language", "auto")
            response = {"text": original_text, "language": detected_lang}
            if body.target_language and original_text:
                response["translated"] = call_translation(original_text, detected_lang, body.target_language)
                response["target_language"] = body.target_language
            return response
        except Exception as e:
            return {"error": str(e), "text": ""}
        finally:
            if wav_path and os.path.exists(wav_path):
                os.remove(wav_path)

    return await loop.run_in_executor(None, process)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, workers=1)
