"""Pre-download openai/whisper-large-v3-turbo into the HF cache at build time.

Usage:
    python download_model.py /path/to/cache-dir

This script is executed during `docker build` so the resulting image already
contains the full model.  At runtime `app.py` reads the same cache directory
with `local_files_only=True`, which prevents *any* network access for model
loading.
"""
import os
import sys
from pathlib import Path

# Speed up parallel transfers
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"


def main(cache_dir: str) -> None:
    from huggingface_hub import snapshot_download

    dest = Path(cache_dir)
    dest.mkdir(parents=True, exist_ok=True)

    print(f"[download_model] Downloading openai/whisper-large-v3-turbo → {cache_dir}")
    snapshot_download(
        repo_id="openai/whisper-large-v3-turbo",
        cache_dir=str(dest),
        local_dir=str(dest / "models--openai--whisper-large-v3-turbo"),
        allow_patterns=[
            "*.safetensors",
            "*.json",
            "*.model",
            "*.txt",
            "tokenizer*",
            "config*",
            "preprocessor*",
            "generation*",
        ],
        ignore_patterns=[
            "*.bin",
            "*.msgpack",
            ".git*",
            "*.md",
            "onnx*",
        ],
        local_files_only=False,
        max_workers=8,
    )
    # List files for visibility
    total = sum(1 for _ in dest.rglob("*") if _.is_file())
    print(f"[download_model] Done. {total} file(s) cached.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python download_model.py /path/to/cache-dir")
        sys.exit(1)
    main(sys.argv[1])
