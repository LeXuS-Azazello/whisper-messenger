"""Pre-downloads NLLB-200-distilled-600M and converts to CTranslate2 INT8 at build time."""
import os
from huggingface_hub import snapshot_download

CACHE_DIR  = os.environ.get("HF_HOME", "/hf-cache")
MODEL_NAME = "facebook/nllb-200-distilled-600M"

print(f"Downloading {MODEL_NAME} to {CACHE_DIR}...")
snapshot_download(
    MODEL_NAME,
    cache_dir=CACHE_DIR,
    local_files_only=False,
)
print("Download complete!")
