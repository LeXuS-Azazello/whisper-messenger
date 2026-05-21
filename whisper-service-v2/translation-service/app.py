"""
Translation Service — NLLB-200-distilled-600M (Meta AI)
- 200+ языков
- CTranslate2 INT8, CPU-only
- FastAPI HTTP сервис

API:
  GET /health
  GET /v1/languages
  POST /v1/translate
"""

import os
import uvicorn
import ctranslate2
import sentencepiece as spm
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Translation Service (NLLB-200)")

MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(os.environ.get("HF_HOME", "/hf-cache"), "facebook", "nllb-200-distilled-600M"))
MODEL_NAME = os.path.basename(MODEL_PATH)
NUM_THREADS = int(os.environ.get("NUM_THREADS", "4"))
INTER_THREADS = int(os.environ.get("INTER_THREADS", "2"))

if not os.path.isdir(MODEL_PATH):
    raise RuntimeError(f"Translation model not found at {MODEL_PATH}. Provide the local model files on disk.")

print(f"[translation-service] Loading model from {MODEL_PATH}...")

translator = ctranslate2.Translator(
    MODEL_PATH,
    device="cpu",
    compute_type="int8",
    intra_threads=NUM_THREADS,
    inter_threads=INTER_THREADS,
)

sp_model_path = os.path.join(MODEL_PATH, "sentencepiece.bpe.model")
sp = spm.SentencePieceProcessor()
sp.Load(sp_model_path)

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
}

print(f"[translation-service] Model loaded! threads={NUM_THREADS}")


def split_into_sentences(text: str, max_len: int = 200) -> list[str]:
    import re

    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    result = []
    for sentence in sentences:
        if len(sentence) > max_len:
            words = sentence.split()
            chunk = []
            for word in words:
                chunk.append(word)
                if len(" ".join(chunk)) > max_len:
                    result.append(" ".join(chunk[:-1]))
                    chunk = [word]
            if chunk:
                result.append(" ".join(chunk))
        elif sentence:
            result.append(sentence)
    return result or [text]


def translate_text(text: str, source_lang: str, target_lang: str) -> str:
    if not text.strip() or source_lang == target_lang:
        return text

    sentences = split_into_sentences(text)
    translated_sentences = []

    for sentence in sentences:
        if hasattr(sp, 'Encode'):
            tokens = sp.Encode(sentence, out_type=str)
        else:
            tokens = sp.EncodeAsPieces(sentence)
        tokens = [source_lang] + tokens
        result = translator.translate_batch(
            [tokens],
            target_prefix=[[target_lang]],
            beam_size=4,
            max_decoding_length=512,
            no_repeat_ngram_size=4,
        )
        translated_tokens = result[0].hypotheses[0][1:]
        if hasattr(sp, 'Decode'):
            translated_sentences.append(sp.Decode(translated_tokens))
        else:
            translated_sentences.append(sp.DecodePieces(translated_tokens))

    return " ".join(translated_sentences)


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
    return {
        "text": translate_text(body.text, body.source_lang, body.target_lang),
        "source_lang": body.source_lang,
        "target_lang": body.target_lang,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8001")))
