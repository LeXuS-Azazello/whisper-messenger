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
import torchaudio.functional as F

# Ограничение ресурсов под Kubernetes (1.5 CPU)
os.environ["CUDA_VISIBLE_DEVICES"] = ""
os.environ["OMP_NUM_THREADS"] = "2"
torch.set_num_threads(2)

TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["MODELSCOPE_CACHE"] = TTS_MODEL_DIR
MODEL_NAME = os.getenv("SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")

_local_model_path = os.path.join(TTS_MODEL_DIR, "hub", MODEL_NAME.replace("/", "/"))
MODEL_LOAD_PATH = _local_model_path if os.path.isdir(_local_model_path) else MODEL_NAME

print(f"[samesame-cosy] Initializing CosyVoice3: {MODEL_LOAD_PATH}")
sys.path.append("/app/CosyVoice")
sys.path.append("/app/CosyVoice/third_party/Matcha-TTS")

from cosyvoice.utils.file_utils import logging
from cosyvoice.cli.cosyvoice import CosyVoice3

try:
    cosyvoice = CosyVoice3(MODEL_LOAD_PATH, load_trt=False, fp16=False)
    print(f"[samesame-cosy] CosyVoice3 loaded successfully.")
except Exception as e:
    print(f"[samesame-cosy] FATAL: Failed to load CosyVoice3: {e}")
    sys.exit(1)

# Инициализация легковесного Whisper для мгновенного распознавания референса
whisper_model = None
try:
    from faster_whisper import WhisperModel as fwModel
    whisper_model = fwModel("tiny", device="cpu", compute_type="float32")
except Exception as e:
    print(f"[samesame-cosy] WARNING: faster-whisper not available: {e}")

SAMPLE_RATE = cosyvoice.sample_rate
SAMESAME_SECRET = os.environ.get("SAMESAME_SECRET")
app = FastAPI(title="Samesame CosyVoice Service")


def detect_language_from_text(text: str) -> str:
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


def decode_audio_base64(audio_b64: str, target_sr: int = 16000) -> tuple[torch.Tensor, int]:
    """Decode base64 audio to tensor entirely in memory — no temp files."""
    audio_bytes = base64.b64decode(audio_b64)
    audio_stream = io.BytesIO(audio_bytes)
    waveform, orig_sr = sf.read(audio_stream, dtype='float32')
    if waveform.ndim == 1:
        waveform = waveform.reshape(1, -1)
    else:
        waveform = waveform.T
    tensor = torch.from_numpy(waveform).float()
    if orig_sr != target_sr:
        tensor = F.resample(tensor, orig_sr, target_sr)
    return tensor, target_sr


def extract_speech_token_direct(frontend, speech_16k: torch.Tensor) -> tuple:
    """Bypass load_wav — pass tensor directly through the speech tokenizer pipeline."""
    device = frontend.device
    speech = speech_16k.to(device)
    if speech.dim() == 1:
        speech = speech.unsqueeze(0)
    if speech.dim() == 2:
        speech = speech.unsqueeze(0)
    assert speech.shape[2] / 16000 <= 30, 'Audio longer than 30s not supported for token extraction'
    mel_transform = torch.nn.Sequential()
    mel_t = torch.nn.MelSpectrogram(
        sample_rate=16000, n_mels=128, n_fft=400, hop_length=160
    ).to(device)
    with torch.no_grad():
        feat = mel_t(speech.float())
        feat = torch.clamp(feat, min=1e-5).log2()
    feat_np = feat.squeeze(0).detach().cpu().numpy()
    speech_token = frontend.speech_tokenizer_session.run(
        None,
        {
            frontend.speech_tokenizer_session.get_inputs()[0].name: feat_np,
            frontend.speech_tokenizer_session.get_inputs()[1].name: np.array([feat_np.shape[2]], dtype=np.int32),
        }
    )[0].flatten().tolist()
    speech_token = torch.tensor([speech_token], dtype=torch.int32).to(device)
    speech_token_len = torch.tensor([speech_token.shape[1]], dtype=torch.int32).to(device)
    return speech_token, speech_token_len


def extract_spk_embedding_direct(frontend, speech_16k: torch.Tensor) -> torch.Tensor:
    """Bypass load_wav — extract speaker embedding from tensor directly."""
    import torchaudio.compliance.kaldi as kaldi
    device = frontend.device
    speech = speech_16k.to(device)
    if speech.dim() == 1:
        speech = speech.unsqueeze(0)
    if speech.dim() == 2:
        speech = speech.unsqueeze(0)
    feat = kaldi.fbank(speech.float(), num_mel_bins=80, dither=0, sample_frequency=16000)
    feat = feat - feat.mean(dim=0, keepdim=True)
    embedding = frontend.campplus_session.run(
        None, {frontend.campplus_session.get_inputs()[0].name: feat.unsqueeze(dim=0).cpu().numpy()}
    )[0].flatten().tolist()
    return torch.tensor([embedding]).to(device)


def extract_speech_feat_direct(frontend, speech_16k: torch.Tensor) -> tuple:
    """Bypass load_wav — extract speech feat from tensor, resample to 24kHz for CosyVoice3."""
    device = frontend.device
    speech = speech_16k.to(device)
    if speech.dim() == 1:
        speech = speech.unsqueeze(0)
    if speech.dim() == 2:
        speech = speech.unsqueeze(0)
    # CosyVoice3 sample rate is typically 24000
    target_sr = getattr(frontend, 'sample_rate', 24000)
    if target_sr != 16000:
        speech = F.resample(speech.float(), 16000, target_sr)
    speech_feat = frontend.feat_extractor(speech.float()).squeeze(dim=0).transpose(0, 1).to(device)
    speech_feat = speech_feat.unsqueeze(dim=0)
    speech_feat_len = torch.tensor([speech_feat.shape[1]], dtype=torch.int32).to(device)
    return speech_feat, speech_feat_len


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
    import numpy as np
    start_time = time.time()
    if SAMESAME_SECRET and authorization != f"Bearer {SAMESAME_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not req.text:
        raise HTTPException(status_code=400, detail="Missing text")

    # Decode audio from base64 to tensor directly — no temp files
    prompt_speech_16k, sr = decode_audio_base64(req.source_audio_base64, target_sr=16000)

    # Limit reference audio to 60 seconds (CosyVoice internally asserts <= 30s, but we allow longer input)
    MAX_PROMPT_SAMPLES = 16000 * 60
    if prompt_speech_16k.shape[-1] > MAX_PROMPT_SAMPLES:
        prompt_speech_16k = prompt_speech_16k[:, :MAX_PROMPT_SAMPLES]

    # Detect language
    lang = (req.language or "").strip().lower()[:2] if req.language else ""
    if not lang:
        lang = detect_language_from_text(req.text)
    allowed_langs = {"ru", "uk", "th", "he", "en", "zh", "ja", "ko", "de", "es", "fr", "it"}
    if lang not in allowed_langs:
        lang = "en"
    cosy_tag = 'ru' if lang == 'uk' else lang
    req_text_with_tag = f"<|{cosy_tag}|>{req.text}"

    # Transcribe reference audio with whisper (from tensor in memory)
    prompt_text, prompt_lang = "", lang
    if whisper_model is not None:
        try:
            audio_np = prompt_speech_16k.squeeze().numpy()
            segments, info = whisper_model.transcribe(audio_np, beam_size=1)
            prompt_text = "".join([seg.text for seg in segments]).strip()
            prompt_lang = info.language or lang
        except Exception as e:
            print(f"[samesame-cosy] Whisper transcription failed: {e}")
    if not prompt_lang:
        prompt_lang = detect_language_from_text(prompt_text) if prompt_text else lang

    print(f"[samesame-cosy] Target Lang: {lang}, Prompt Lang: {prompt_lang}, Strategy Choice Started")

    # Build model input manually — bypass load_wav entirely
    frontend = cosyvoice.frontend
    device = frontend.device if hasattr(frontend, 'device') else torch.device('cpu')

    tts_text_token = frontend.tokenizer.encode(req_text_with_tag, allowed_special=frontend.allowed_special)
    tts_text_token = torch.tensor([tts_text_token], dtype=torch.int32).to(device)
    tts_text_token_len = torch.tensor([tts_text_token.shape[1]], dtype=torch.int32).to(device)

    try:
        prompt_speech_16k_dev = prompt_speech_16k.to(device)

        speech_token, speech_token_len = extract_speech_token_direct(frontend, prompt_speech_16k_dev)
        speech_feat, speech_feat_len = extract_speech_feat_direct(frontend, prompt_speech_16k_dev)
        embedding = extract_spk_embedding_direct(frontend, prompt_speech_16k_dev)

        if speech_feat.shape[1] > 0 and speech_token.shape[1] > 0:
            token_len = min(int(speech_feat.shape[1] / 2), speech_token.shape[1])
            speech_feat = speech_feat[:, :2 * token_len, :]
            speech_feat_len = torch.tensor([2 * token_len], dtype=torch.int32).to(device)
            speech_token = speech_token[:, :token_len]
            speech_token_len = torch.tensor([token_len], dtype=torch.int32).to(device)

        prompt_text_token = frontend.tokenizer.encode(prompt_text, allowed_special=frontend.allowed_special) if prompt_text else ""
        if prompt_text_token:
            prompt_text_token = torch.tensor([prompt_text_token], dtype=torch.int32).to(device)
            prompt_text_token_len = torch.tensor([prompt_text_token.shape[1]], dtype=torch.int32).to(device)
        else:
            prompt_text_token = torch.tensor([[0]], dtype=torch.int32).to(device)
            prompt_text_token_len = torch.tensor([1], dtype=torch.int32).to(device)

        model_input = {
            'text': tts_text_token,
            'text_len': tts_text_token_len,
            'prompt_text': prompt_text_token,
            'prompt_text_len': prompt_text_token_len,
            'llm_prompt_speech_token': speech_token,
            'llm_prompt_speech_token_len': speech_token_len,
            'flow_prompt_speech_token': speech_token,
            'flow_prompt_speech_token_len': speech_token_len,
            'prompt_speech_feat': speech_feat,
            'prompt_speech_feat_len': speech_feat_len,
            'llm_embedding': embedding,
            'flow_embedding': embedding,
        }

        if prompt_text and (prompt_lang == lang or (prompt_lang in ['ru', 'uk'] and lang in ['ru', 'uk'])):
            print("[samesame-cosy] Strategy: zero_shot (direct tensor)")
        else:
            print("[samesame-cosy] Strategy: cross_lingual (direct tensor)")
            del model_input['prompt_text']
            del model_input['prompt_text_len']
            del model_input['llm_prompt_speech_token']
            del model_input['llm_prompt_speech_token_len']

        output = cosyvoice.model.tts(**model_input, stream=False, speed=1.0)

        tts_audios = [chunk["tts_speech"] for chunk in output if "tts_speech" in chunk]
        if not tts_audios:
            raise ValueError("CosyVoice returned empty audio chunks")

        tts_audio = torch.cat(tts_audios, dim=1).squeeze().detach().cpu().numpy()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CosyVoice generation error: {e}")

    # Encode result to base64 — all in memory
    out_buffer = io.BytesIO()
    mime = "audio/ogg"
    try:
        sf.write(out_buffer, tts_audio, SAMPLE_RATE, format='OGG', subtype='OPUS')
    except Exception:
        out_buffer = io.BytesIO()
        sf.write(out_buffer, tts_audio, SAMPLE_RATE, format='WAV')
        mime = "audio/wav"

    res_base64 = base64.b64encode(out_buffer.getvalue()).decode('utf-8')
    latency_ms = int((time.time() - start_time) * 1000)
    print(f"[samesame-cosy] Success! Latency: {latency_ms}ms, Format: {mime}")

    return {
        "audio_base64": res_base64,
        "mime_type": mime,
        "duration_seconds": round(len(tts_audio) / SAMPLE_RATE, 2),
        "latency_ms": latency_ms,
    }
