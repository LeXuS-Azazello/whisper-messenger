import base64
import os
import sys
import io
import time
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
import soundfile as sf

# Ограничение ресурсов под Kubernetes (1.5 CPU)
os.environ["CUDA_VISIBLE_DEVICES"] = ""  # Force CPU if GPU not present/needed
os.environ["OMP_NUM_THREADS"] = "2"
torch.set_num_threads(2)

TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["MODELSCOPE_CACHE"] = TTS_MODEL_DIR
MODEL_NAME = os.environ.get("SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")

_local_model_path = os.path.join(TTS_MODEL_DIR, "hub", MODEL_NAME.replace("/", "/"))
MODEL_LOAD_PATH = _local_model_path if os.path.isdir(_local_model_path) else MODEL_NAME

print(f"[samesame-cosy] Initializing CosyVoice3: {MODEL_LOAD_PATH}")
sys.path.append("/app/CosyVoice")
sys.path.append("/app/CosyVoice/third_party/Matcha-TTS")

from cosyvoice.utils.file_utils import load_wav
from cosyvoice.cli.cosyvoice import CosyVoice3

try:
    # Инициализация модели CosyVoice3
    cosyvoice = CosyVoice3(MODEL_LOAD_PATH, load_trt=False, fp16=False)
    print(f"[samesame-cosy] CosyVoice3 loaded successfully.")
except Exception as e:
    print(f"[samesame-cosy] FATAL: Failed to load CosyVoice3: {e}")
    sys.exit(1)

# Инициализация легковесного Whisper для мгновенного распознавания референса
try:
    from faster_whisper import WhisperModel
    whisper_model = WhisperModel("tiny", device="cpu", compute_type="float32")
except Exception as e:
    print(f"[samesame-cosy] WARNING: faster-whisper not found, installing via pip is recommended: {e}")
    whisper_model = None

SAMPLE_RATE = cosyvoice.sample_rate
SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
app = FastAPI(title="Samesame CosyVoice Service")


def detect_language_from_text(text: str) -> str:
    """Определение языка по символам для точного маппинга CosyVoice3."""
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
    if cyrillic > max(2, len(text) * 0.15):
        if any(ch.lower() in set('ґєії') for ch in text):
            return 'uk'
        return 'ru'
    if sum(1 for c in text if '\u0e00' <= c <= '\u0e7f') > 0:
        return 'th'
    if sum(1 for c in text if '\u0590' <= c <= '\u05ff') > 0:
        return 'he'
    return 'en'


def transcribe_prompt_audio(audio_tensor: torch.Tensor) -> tuple[str, str]:
    """Быстрое распознавание текста из аудио-референса в памяти."""
    if whisper_model is None:
        return "", "en"
    try:
        # Конвертация тензора в numpy массив для faster-whisper
        audio_np = audio_tensor.squeeze().numpy()
        segments, info = whisper_model.transcribe(audio_np, beam_size=1)
        text = "".join([seg.text for seg in segments]).strip()
        return text, info.language
    except Exception as e:
        print(f"[samesame-cosy] Whisper transcription failed: {e}")
        return "", "en"


class CloneRequest(BaseModel):
    source_audio_base64: str
    source_mime_type: Optional[str] = "audio/ogg"
    text: str
    language: Optional[str] = None
    output_format: Optional[str] = "ogg"


@app.get("/health")
@app.get("/live")
def health():
    return {"status": "ok", "model": MODEL_NAME, "backend": "cosyvoice3"}


@app.post("/v1/clone")
def clone_voice(req: CloneRequest, authorization: Optional[str] = Header(None)):
    start_time = time.time()
    if SAMESAME_SECRET and authorization != f"Bearer {SAMESAME_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    try:
        audio_bytes = base64.b64decode(req.source_audio_base64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 encoding")

    # Чтение входящего аудио полностью в памяти без создания временных файлов
    try:
        audio_stream = io.BytesIO(audio_bytes)
        prompt_speech, input_sr = sf.read(audio_stream, dtype='float32')
        prompt_speech_16k = torch.tensor(prompt_speech).unsqueeze(0)
        
        # Ресемплинг в 16кГц, если необходимо
        if input_sr != 16000:
            import torchaudio.functional as F
            prompt_speech_16k = F.resample(prompt_speech_16k, input_sr, 16000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode source audio: {e}")

    # Ограничение длины референса до 29 секунд
    MAX_PROMPT_LEN = 16000 * 29
    if prompt_speech_16k.shape[1] > MAX_PROMPT_LEN:
        prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_LEN]

    # Автоматическое определение целевого языка
    lang = (req.language or "").strip().lower()[:2] if req.language else ""
    if not lang:
        lang = detect_language_from_text(req.text)

    # Валидация поддерживаемых языков CosyVoice3
    allowed_langs = {"ru", "uk", "th", "he", "en", "zh", "ja", "ko", "de", "es", "fr", "it"}
    if lang not in allowed_langs:
        lang = "en"

    # Формирование языкового тега для CosyVoice3
    cosy_tag = 'ru' if lang == 'uk' else lang
    req_text_with_tag = f"<|{cosy_tag}|>{req.text}"

    # Быстрая транскрипция аудио-референса
    prompt_text, prompt_lang = transcribe_prompt_audio(prompt_speech_16k)
    if not prompt_lang:
        prompt_lang = detect_language_from_text(prompt_text) if prompt_text else lang

    print(f"[samesame-cosy] Target Lang: {lang}, Prompt Lang: {prompt_lang}, Strategy Choice Started")

    try:
        # Выбор оптимальной стратегии генерации
        if prompt_text and (prompt_lang == lang or prompt_lang in ['ru', 'uk'] and lang in ['ru', 'uk']):
            print("[samesame-cosy] Strategy: zero_shot")
            output = cosyvoice.inference_zero_shot(req_text_with_tag, prompt_text, prompt_speech_16k, stream=False)
        else:
            print("[samesame-cosy] Strategy: cross_lingual")
            output = cosyvoice.inference_cross_lingual(req_text_with_tag, prompt_speech_16k, stream=False)

        tts_audios = [chunk["tts_speech"] for chunk in output if "tts_speech" in chunk]
        if not tts_audios:
            raise ValueError("CosyVoice returned empty audio chunks")

        tts_audio = torch.cat(tts_audios, dim=1).squeeze().numpy()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CosyVoice generation error: {e}")

    # Быстрое кодирование результата в памяти (Без вызова утилиты ffmpeg)
    out_buffer = io.BytesIO()
    if req.output_format.lower() == "ogg":
        # Используем soundfile для записи напрямую в ogg/opus (требуется libsndfile с поддержкой ogg)
        try:
            sf.write(out_buffer, tts_audio, SAMPLE_RATE, format='OGG', subtype='OPUS')
            mime = "audio/ogg"
        except Exception:
            # Фолбек на WAV, если системный libsndfile собран без поддержки OGG
            sf.write(out_buffer, tts_audio, SAMPLE_RATE, format='WAV')
            mime = "audio/wav"
    else:
        sf.write(out_buffer, tts_audio, SAMPLE_RATE, format='WAV')
        mime = "audio/wav"

    res_base64 = base64.b64encode(out_buffer.getvalue()).decode('utf-8')
    latency_ms = int((time.time() - start_time) * 1000)
    print(f"[samesame-cosy] Success! Latency: {latency_ms}ms, Format: {mime}")

    return {
        "audio_base64": res_base64,
        "mime_type": mime,
        "duration_seconds": round(len(tts_audio) / SAMPLE_RATE, 2),
        "latency_ms": latency_ms
    }
