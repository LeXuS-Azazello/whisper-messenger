"""
Translation Service — NLLB-200-distilled-600M (Meta AI)
- 200+ языков (RU, EN, ZH, DE, FR, UK, AR, JA, KO, ...)
- CTranslate2 backend — INT8, ~300MB, быстро на CPU
- FastAPI HTTP сервис

API:
  POST /v1/translate
  Body: { "text": "...", "source_lang": "rus_Cyrl", "target_lang": "eng_Latn" }
  Response: { "text": "...", "source_lang": "rus_Cyrl", "target_lang": "eng_Latn" }

  GET /v1/languages  — список поддерживаемых языков

Коды языков NLLB-200:
  русский    → rus_Cyrl
  английский → eng_Latn
  китайский  → zho_Hans
  немецкий   → deu_Latn
  французский→ fra_Latn
  украинский → ukr_Cyrl
  испанский  → spa_Latn
  арабский   → arb_Arab
  японский   → jpn_Jpan
  корейский  → kor_Hang
  (полный список: /v1/languages)
"""

import os
import uvicorn
import ctranslate2
import sentencepiece as spm
from fastapi import FastAPI
from pydantic import BaseModel
from huggingface_hub import snapshot_download

app = FastAPI(title="Translation Service (NLLB-200)")

CACHE_DIR   = os.environ.get("HF_HOME", "/hf-cache")
MODEL_NAME  = "facebook/nllb-200-distilled-600M"
NUM_THREADS = int(os.environ.get("NUM_THREADS", "4"))
INTER_THREADS = int(os.environ.get("INTER_THREADS", "2"))

# ── Загрузка модели ──────────────────────────────────────────────────────────

print(f"[translate] Loading {MODEL_NAME}...")

model_path = snapshot_download(
    MODEL_NAME,
    cache_dir=CACHE_DIR,
    local_files_only=os.environ.get("HF_LOCAL_FILES_ONLY", "false").lower() in ("true", "1"),
)

translator = ctranslate2.Translator(
    model_path,
    device="cpu",
    compute_type="int8",
    intra_threads=NUM_THREADS,
    inter_threads=INTER_THREADS,
)

# Tokenizer
sp_model_path = os.path.join(model_path, "sentencepiece.bpe.model")
sp = spm.SentencePieceProcessor()
sp.Load(sp_model_path)

print(f"[translate] Model loaded! threads={NUM_THREADS}")

# ── Список языков ────────────────────────────────────────────────────────────

LANGUAGES = {
    "rus_Cyrl": "Русский",
    "eng_Latn": "English",
    "zho_Hans": "中文 (упрощённый)",
    "zho_Hant": "中文 (традиционный)",
    "deu_Latn": "Deutsch",
    "fra_Latn": "Français",
    "spa_Latn": "Español",
    "ukr_Cyrl": "Українська",
    "arb_Arab": "العربية",
    "jpn_Jpan": "日本語",
    "kor_Hang": "한국어",
    "ita_Latn": "Italiano",
    "por_Latn": "Português",
    "pol_Latn": "Polski",
    "tur_Tglg": "Türkçe",
    "nld_Latn": "Nederlands",
    "vie_Latn": "Tiếng Việt",
    "tha_Thai": "ภาษาไทย",
    "heb_Hebr": "עברית",
    "hin_Deva": "हिन्दी",
    "ind_Latn": "Bahasa Indonesia",
    "ron_Latn": "Română",
    "ces_Latn": "Čeština",
    "hun_Latn": "Magyar",
    "swe_Latn": "Svenska",
    "dan_Latn": "Dansk",
    "fin_Latn": "Suomi",
    "nor_Latn": "Norsk",
    "kat_Geor": "ქართული",
    "kaz_Cyrl": "Қазақша",
    "bel_Cyrl": "Беларуская",
    "uzb_Latn": "O'zbek",
    "azj_Latn": "Azərbaycan",
    "hye_Armn": "Հայերեն",
}

# ── Утилиты ──────────────────────────────────────────────────────────────────

def split_into_sentences(text: str, max_len: int = 200) -> list[str]:
    """Разбивает текст на предложения для батчевого перевода."""
    import re
    # Разбиваем по знакам конца предложения
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    result = []
    for s in sentences:
        # Если предложение слишком длинное — режем по словам
        if len(s) > max_len:
            words = s.split()
            chunk = []
            for w in words:
                chunk.append(w)
                if len(" ".join(chunk)) > max_len:
                    result.append(" ".join(chunk[:-1]))
                    chunk = [w]
            if chunk:
                result.append(" ".join(chunk))
        elif s:
            result.append(s)
    return result or [text]


def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    """Переводит текст через NLLB-200."""
    if not text.strip():
        return text
    if source_lang == target_lang:
        return text

    sentences = split_into_sentences(text)
    translated_sentences = []

    for sentence in sentences:
        tokens = sp.Encode(sentence, out_type=str)
        tokens = [source_lang] + tokens  # язык-источник как первый токен

        result = translator.translate_batch(
            [tokens],
            target_prefix=[[target_lang]],
            beam_size=4,
            max_decoding_length=512,
            no_repeat_ngram_size=4,
        )

        translated_tokens = result[0].hypotheses[0][1:]  # убираем токен языка
        translated = sp.Decode(translated_tokens)
        translated_sentences.append(translated)

    return " ".join(translated_sentences)


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model": MODEL_NAME, "languages": len(LANGUAGES)}


@app.get("/v1/languages")
async def list_languages():
    return {"languages": LANGUAGES}


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "rus_Cyrl"
    target_lang: str = "eng_Latn"


@app.post("/v1/translate")
async def translate(body: TranslateRequest):
    import asyncio
    loop = asyncio.get_event_loop()

    def process():
        try:
            result = translate_text(body.text, body.source_lang, body.target_lang)
            return {
                "text": result,
                "source_lang": body.source_lang,
                "target_lang": body.target_lang,
                "original": body.text,
            }
        except Exception as e:
            print(f"[translate] Error: {e}")
            return {"error": str(e), "text": body.text}

    return await loop.run_in_executor(None, process)


class TranscribeAndTranslateRequest(BaseModel):
    """Комбинированный запрос: транскрипция уже сделана, нужен только перевод."""
    transcribed_text: str
    detected_lang: str = "auto"       # язык аудио (из ASR)
    target_lang: str = "eng_Latn"     # на какой язык переводить

    # Маппинг коротких кодов ISO → NLLB коды
    LANG_MAP: dict = {
        "ru": "rus_Cyrl", "en": "eng_Latn", "zh": "zho_Hans",
        "de": "deu_Latn", "fr": "fra_Latn", "es": "spa_Latn",
        "uk": "ukr_Cyrl", "ar": "arb_Arab", "ja": "jpn_Jpan",
        "ko": "kor_Hang", "it": "ita_Latn", "pt": "por_Latn",
        "pl": "pol_Latn", "tr": "tur_Tglg", "nl": "nld_Latn",
        "vi": "vie_Latn", "th": "tha_Thai", "he": "heb_Hebr",
        "hi": "hin_Deva", "id": "ind_Latn",
    }

    class Config:
        arbitrary_types_allowed = True


@app.post("/v1/translate-transcription")
async def translate_transcription(body: TranscribeAndTranslateRequest):
    """
    Специальный endpoint для клиентов:
    принимает распознанный текст и язык из ASR,
    автоматически определяет NLLB-код и переводит.
    """
    import asyncio
    loop = asyncio.get_event_loop()

    def process():
        # Резолвим язык источника
        lang_map = body.LANG_MAP
        src = lang_map.get(body.detected_lang, body.detected_lang)
        if src == "auto" or src not in LANGUAGES:
            src = "rus_Cyrl"  # дефолт если не определён

        tgt = lang_map.get(body.target_lang, body.target_lang)

        try:
            translated = translate_text(body.transcribed_text, src, tgt)
            return {
                "original": body.transcribed_text,
                "translated": translated,
                "source_lang": src,
                "target_lang": tgt,
            }
        except Exception as e:
            return {"error": str(e), "original": body.transcribed_text, "translated": body.transcribed_text}

    return await loop.run_in_executor(None, process)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001, workers=1)
