"""Pre-downloads NLLB-200-distilled-600M for the translation service."""
import os
from huggingface_hub import snapshot_download

CACHE_DIR = os.environ.get("HF_HOME", "/hf-cache")
MODEL_NAME = os.environ.get("NLLB_MODEL", "facebook/nllb-200-distilled-600M")

print(f"[translation-service] Downloading {MODEL_NAME} to {CACHE_DIR}...")
snapshot_download(
    MODEL_NAME,
    cache_dir=CACHE_DIR,
    local_files_only=os.environ.get("HF_LOCAL_FILES_ONLY", "false").lower() in ("true", "1"),
)
print("[translation-service] Download complete!")
