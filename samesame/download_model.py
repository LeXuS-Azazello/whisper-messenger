import os
import sys

os.environ["XDG_DATA_HOME"] = os.environ.get("TTS_MODEL_DIR", "/models")
os.environ["TRANSFORMERS_CACHE"] = os.environ.get("TTS_MODEL_DIR", "/models")

from TTS.api import TTS

MODEL_NAME = os.environ.get("SAMESAME_MODEL_NAME", "tts_models/multilingual/multi-dataset/your_tts")
TTS_MODEL_DIR = os.environ.get("TTS_MODEL_DIR", "/models")

os.environ.setdefault("TTS_MODEL_DIR", TTS_MODEL_DIR)
os.environ.setdefault("HF_HOME", TTS_MODEL_DIR)
os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")
if os.environ.get("HUGGINGFACE_API_KEY"):
    os.environ.setdefault("HUGGINGFACE_API_KEY", os.environ.get("HUGGINGFACE_API_KEY"))
    os.environ.setdefault("HUGGING_FACE_HUB_TOKEN", os.environ.get("HUGGINGFACE_API_KEY"))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_model.py /path/to/model-dir")
        sys.exit(1)

    model_dir = sys.argv[1]
    os.makedirs(model_dir, exist_ok=True)
    os.environ["TTS_MODEL_DIR"] = model_dir
    os.environ["HF_HOME"] = model_dir

    print(f"Downloading SAMESAME model {MODEL_NAME} into {model_dir}")
    # NOTE: Do NOT pass vocoder_name — modern Coqui TTS (your_tts) does not accept it.
    # The downloader Job is the ONLY place that should ever trigger downloads.
    TTS(model_name=MODEL_NAME, progress_bar=True, gpu=False)

    print("Download complete")
