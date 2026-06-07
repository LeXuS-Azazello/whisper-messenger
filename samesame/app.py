import base64
import hashlib
import io
import os
import re
import sys
import time
import uuid
import gc
import threading
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import torch
import soundfile as sf
import torchaudio.functional as F
import numpy as np
from redis import Redis, ConnectionPool

os.environ["CUDA_VISIBLE_DEVICES"] = ""
CPU_THREADS = int(os.getenv("CPU_THREADS", "4"))
os.environ["OMP_NUM_THREADS"] = str(CPU_THREADS)
os.environ["MKL_NUM_THREADS"] = str(CPU_THREADS)
os.environ["TOKENIZERS_PARALLELISM"] = "false"

torch.set_num_threads(CPU_THREADS)
torch.set_num_interop_threads(1)

TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["MODELSCOPE_CACHE"] = TTS_MODEL_DIR
MODEL_NAME = os.getenv("SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")

_local_model_path = os.path.join(TTS_MODEL_DIR, "hub", MODEL_NAME.replace("/", "/"))
MODEL_LOAD_PATH = _local_model_path if os.path.isdir(_local_model_path) else MODEL_NAME

print(f"[samesame-cosy] Initializing CosyVoice3: {MODEL_LOAD_PATH}")

if not os.path.isdir(_local_model_path):
    print(f"[samesame-cosy] Model not found at {_local_model_path}, waiting for downloader job...")
    for i in range(120):
        time.sleep(5)
        if os.path.isdir(_local_model_path):
            print(f"[samesame-cosy] Model appeared after {i*5}s")
            break
    else:
        print(f"[samesame-cosy] FATAL: Model not found after 10 minutes, exiting")
        sys.exit(1)

sys.path.append("/app/CosyVoice")
sys.path.append("/app/CosyVoice/third_party/Matcha-TTS")

from cosyvoice.utils.file_utils import logging, load_wav
from cosyvoice.cli.cosyvoice import CosyVoice3

try:
    cosyvoice = CosyVoice3(MODEL_LOAD_PATH, load_trt=False, fp16=False)
    _inference_lock = threading.Lock()
    print(f"[samesame-cosy] CosyVoice3 loaded successfully.")
except Exception as e:
    print(f"[samesame-cosy] FATAL: Failed to load CosyVoice3: {e}")
    sys.exit(1)

SAMPLE_RATE = cosyvoice.sample_rate
SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
import logging

class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "GET /health" in msg or "GET /live" in msg or "GET /ready" in msg:
            return False
        return True

logging.getLogger("uvicorn.access").addFilter(EndpointFilter())

app = FastAPI(title="Samesame CosyVoice Service")

REDIS_HOST = os.getenv("REDIS_HOST", "redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_TTL = int(os.getenv("PROMPT_CACHE_TTL", "1800"))

pool = ConnectionPool(
    host=REDIS_HOST,
    port=REDIS_PORT,
    max_connections=20,
    socket_timeout=3,
    socket_connect_timeout=3
)

redis_client = Redis(
    connection_pool=pool,
    decode_responses=False
)

FUNASR_URL = os.getenv("FUNASR_URL", "http://funasr:8000")
TEMP_DIR = os.getenv("SAMESAME_TEMP_DIR", "/temporaly-media-msg")

try:
    warm_file = f"{TEMP_DIR}/warmup_{uuid.uuid4().hex}.wav"
    warm_noise = np.random.normal(0, 0.001, 16000 * 3)
    sf.write(warm_file, warm_noise, 16000)
    list(
        cosyvoice.inference_cross_lingual(
            tts_text="<|en|>test voice cloning warmup",
            prompt_wav=warm_file,
            text_frontend=False
        )
    )
    os.remove(warm_file)
    print("[warmup] done")
except Exception as e:
    print("[warmup]", e)

def detect_language_from_audio_snippet(prompt_tensor: torch.Tensor, sr: int = 16000) -> str:
    """
    Быстрый детект языка по первым 3 секундам промпта.
    Использует funasr с отключёнными VAD и пунктуацией.
    Сначала берёт language из ответа, как резерв — detect_language_from_text().
    """
    try:
        import requests
        snippet = prompt_tensor[:, :sr * 3]
        snippet_path = f"{TEMP_DIR}/lang_detect_{uuid.uuid4().hex}.wav"
        sf.write(snippet_path, snippet.squeeze(0).numpy(), sr, format="WAV")
        try:
            resp = requests.post(
                f"{FUNASR_URL}/v1/transcribe-base64",
                json={
                    "file_path": snippet_path,
                    "enable_vad": False,
                    "enable_punc": False,
                    "language": "auto"
                },
                timeout=15
            )
            if resp.ok:
                data = resp.json()
                lang = data.get("language")
                if lang:
                    return lang[:2].lower()
                text_snippet = data.get("text", "")
                if text_snippet:
                    return detect_language_from_text(text_snippet)
        finally:
            try:
                os.remove(snippet_path)
            except:
                pass
    except Exception as e:
        print(f"[samesame] audio lang detect failed: {e}")
    return "en"  # fallback


def detect_language_from_text(text: str) -> str:
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04ff')
    if cyrillic > max(2, len(text) * 0.15):
        if any(ch.lower() in set('ґєії') for ch in text):
            return 'uk'
        return 'ru'
    if sum(1 for c in text if '\u0e00' <= c <= '\u0e7f') > 0:
        return 'th'
    if sum(1 for c in text if '\u0590' <= c <= '\u05ff') > 0:
        return 'he'
    latin = sum(ch.isascii() and ch.isalpha() for ch in text)

    if latin > max(3, len(text) * 0.25):
        return "en"

    return "en"


def split_text(text: str, max_len: int = 150) -> list:
    parts = []
    current = ""
    tokens = re.split(r'([.!?。！？])', text)
    for token in tokens:
        if len(current) + len(token) < max_len:
            current += token
        else:
            if current.strip():
                parts.append(current.strip())
            current = token
    if current.strip():
        parts.append(current.strip())
    return parts


def decode_audio_base64(audio_b64: str, target_sr: int = 16000) -> tuple[torch.Tensor, int]:
    audio_bytes = base64.b64decode(audio_b64)
    audio_stream = io.BytesIO(audio_bytes)
    waveform, orig_sr = sf.read(audio_stream, dtype='float32')
    
    if waveform.ndim > 1:
        waveform = waveform.mean(axis=1)
    
    waveform = waveform.reshape(1, -1)
    tensor = torch.from_numpy(waveform).float()
    
    if orig_sr != target_sr:
        tensor = F.resample(tensor, orig_sr, target_sr)
    return tensor, target_sr


def prompt_cache_filename(audio_b64: str) -> str:
    return hashlib.sha256(audio_b64.encode()).hexdigest()


class CloneRequest(BaseModel):
    source_audio_base64: Optional[str] = None
    source_audio_path: Optional[str] = None
    text: str
    prompt_language: Optional[str] = None
    language: Optional[str] = None
    output_format: Optional[str] = "ogg"
    use_cache: Optional[bool] = False
    user_id: Optional[str] = None


@app.get("/health")
@app.get("/live")
def health():
    redis_ok = False
    try:
        redis_ok = redis_client.ping()
    except:
        pass
    return {"status": "ok", "model": MODEL_NAME, "backend": "cosyvoice3", "redis": redis_ok}


@app.post("/v1/clone")
def clone_voice(
    req: CloneRequest,
    authorization: Optional[str] = Header(None)
):
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    start_time = time.time()
    timings = {}
    if SAMESAME_SECRET and authorization != f"Bearer {SAMESAME_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    try:
        t = time.time()
        if req.source_audio_path and os.path.isfile(req.source_audio_path):
            waveform, orig_sr = sf.read(req.source_audio_path, dtype='float32')
            if waveform.ndim > 1:
                waveform = waveform.mean(axis=1)
            waveform = waveform.reshape(1, -1)
            tensor = torch.from_numpy(waveform).float()
            if orig_sr != 16000:
                tensor = F.resample(tensor, orig_sr, 16000)
            prompt_speech_16k = tensor
        elif req.source_audio_base64:
            prompt_speech_16k, _ = decode_audio_base64(req.source_audio_base64, target_sr=16000)
        else:
            raise HTTPException(status_code=400, detail="Missing audio data or path")
        timings["decode_ms"] = int((time.time()-t)*1000)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio data: {e}")

    # Trim silence first to evaluate true speech length
    audio_np = prompt_speech_16k.squeeze(0).cpu().numpy()
    mask = np.abs(audio_np) > 0.05
    if np.any(mask):
        indices = np.where(mask)[0]
        start = indices[0]
        end = indices[-1] + 1
        prompt_speech_16k = torch.from_numpy(audio_np[start:end]).unsqueeze(0).float()

    true_audio_samples = prompt_speech_16k.shape[-1]

    # Finally limit to 14 seconds for inference stability
    MAX_PROMPT_SAMPLES = 16000 * 14
    if prompt_speech_16k.shape[-1] > MAX_PROMPT_SAMPLES:
        prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_SAMPLES]

    LANG_MAP = {
        "uk": "uk", "ukr": "uk", "ukrainian": "uk", "uk-ua": "uk",
        "ru": "ru", "rus": "ru", "russian": "ru", "ru-ru": "ru",
        "en": "en", "eng": "en", "english": "en", "en-us": "en", "en-gb": "en",
        "zh": "zh", "zho": "zh", "chi": "zh", "zh-cn": "zh",
        "ja": "ja", "jpn": "ja", "jp": "ja",
        "ko": "ko", "kor": "ko",
        "es": "es", "spa": "es",
        "fr": "fr", "fra": "fr",
        "de": "de", "deu": "de",
        "it": "it", "ita": "it",
        "pt": "pt", "por": "pt",
        "th": "th", "tha": "th",
        "he": "he", "heb": "he",
    }
    
    lang = None
    if req.language:
        raw_lang = req.language.strip().lower().replace("_", "-")
        lang = LANG_MAP.get(raw_lang) or (raw_lang[:2] if len(raw_lang) >= 2 else None)

    if not lang:
        t_lang = time.time()
        lang = detect_language_from_audio_snippet(prompt_speech_16k)
        timings["lang_detect_ms"] = int((time.time() - t_lang) * 1000)

    if lang not in {"ru","uk","th","he","en","zh","ja","ko","de","es","fr","it","pt"}:
        lang = "en"

    FAST_LANGS = {"ru", "uk", "en", "de", "fr", "es", "it", "pt"}
    use_frontend = lang not in FAST_LANGS

    text_chunks = split_text(req.text, max_len=180)
    print(f"[cosy] target={lang}, chunks={len(text_chunks)}")

    cache_key = hashlib.sha256(
        prompt_speech_16k.squeeze().numpy().tobytes()
    ).hexdigest()
    cache_file = f"{TEMP_DIR}/samesame_prompt_{uuid.uuid4().hex}.wav"
    
    cached_audio = None

    # TODO: re-enable cache
    # if req.use_cache:
    #     try:
    #         cached_audio = redis_client.get(cache_key)
    #     except Exception as e:
    #         print("[redis get]", e)

    if cached_audio:
        with open(cache_file, "wb") as f:
            f.write(cached_audio)
    else:
        wav_bytes = io.BytesIO()
        sf.write(wav_bytes, prompt_speech_16k.squeeze(0).cpu().numpy(), 16000, format="WAV")
        payload = wav_bytes.getvalue()
        # TODO: re-enable cache
        # try:
        #     if req.use_cache:
        #         redis_client.setex(cache_key, REDIS_TTL, payload)
        # except Exception as e:
        #     print("[redis set]", e)
        
        with open(cache_file, "wb") as f:
            f.write(payload)

    try:
        all_audio_chunks = []
        t1 = time.time()
        for chunk_text in text_chunks:
            print(f"[cosy] synthesizing: {chunk_text[:50]}...")
            
            # Inject language token so the model doesn't hallucinate (e.g. Russian -> Chinese)
            # Use 'jp' for Japanese instead of 'ja' if that's what CosyVoice expects internally, but 'ja' works if we allow it.
            # Fun-CosyVoice3 typically uses <|lang|> tags for control.
            LANG_TOKEN_MAP = {
                "ru": "<|ru|>",
                "uk": "<|uk|>",
                "en": "<|en|>",
                "zh": "<|zh|>",
                "ja": "<|jp|>",
                "ko": "<|ko|>",
                "de": "<|de|>",
                "fr": "<|fr|>",
                "es": "<|es|>",
                "it": "<|it|>",
                "pt": "<|pt|>",
                "th": "<|th|>",
                "he": "<|en|>",  # fallback
            }

            # If user didn't provide prompt text, we MUST construct one to avoid cross-lingual hallucination (defaulting to Chinese)
            # A known hack is to use the chunk_text as the prompt_text transcript.
            # Fun-CosyVoice3-0.5B-2512 requires <|lang|> tags.
            # The previous working code used <|lang|>chunk_text<|endofprompt|> for prompt_text
            # and just chunk_text for tts_text, OR maybe <|lang|> for tts_text too.
            # Let's use the explicit <|lang|> for tts_text, and if no prompt_text is provided, pass a generic one or the chunk itself.
            
            lang_token = LANG_TOKEN_MAP.get(lang, f"<|{lang}|>")
            
            chunk_with_lang = f"{lang_token}{chunk_text}"
            
            with torch.inference_mode(), _inference_lock:
                # TODO: re-enable when needed.
                # prompt_text_str = getattr(req, "prompt_text", "").strip()
                # if prompt_text_str:
                #     ... inference_zero_shot ...
                output = cosyvoice.inference_cross_lingual(
                    tts_text=chunk_with_lang,
                    prompt_wav=cache_file,
                    text_frontend=use_frontend
                )
                
                for item in output:
                    if "tts_speech" in item:
                        all_audio_chunks.append(item["tts_speech"].squeeze().cpu().numpy())
        print(f"[cosy] infer time: {time.time()-t1:.3f}s")

        if not all_audio_chunks:
            raise ValueError("empty audio")

        audio = np.concatenate(all_audio_chunks) if len(all_audio_chunks) > 1 else all_audio_chunks[0]

    except Exception as e:
        import traceback
        print(f"[cosy] ERROR: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(cache_file)
        except:
            pass

    t2 = time.time()
    output_path = f"{TEMP_DIR}/samesame_out_{uuid.uuid4().hex}.wav"
    
    sf.write(
        output_path,
        audio,
        SAMPLE_RATE,
        format="WAV"
    )
    mime = "audio/wav"
    
    print(f"[cosy] encode time: {time.time()-t2:.3f}s")
    timings["encode_ms"] = int((time.time()-t2)*1000)
    timings["total_ms"] = int((time.time()-start_time)*1000)

    return {
        "output_path": output_path,
        "mime_type": mime,
        "duration_seconds": round(len(audio) / SAMPLE_RATE, 2),
        "latency_ms": timings["total_ms"],
        "language": lang,
        "timings": timings
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8002
    )