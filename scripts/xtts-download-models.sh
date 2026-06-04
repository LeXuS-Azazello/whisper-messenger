#!/bin/sh
set -eu

MODELS_DIR="${MODELS_DIR:-/models}"

echo "[xtts-downloader] MODELS_DIR=${MODELS_DIR}"

mkdir -p "${MODELS_DIR}"
mkdir -p "${MODELS_DIR}/tts_models"

export XDG_DATA_HOME="${MODELS_DIR}"
export HF_HOME="${MODELS_DIR}/hf"
export HUGGINGFACE_HUB_CACHE="${MODELS_DIR}/hf"
export TRANSFORMERS_CACHE="${MODELS_DIR}/hf"

TARGET_DIR="${MODELS_DIR}/tts_models/xtts_v2"
LOCK_FILE="${TARGET_DIR}/.download.lock"
DONE_FILE="${TARGET_DIR}/.ready"

if [ -f "${DONE_FILE}" ]; then
    echo "[xtts-downloader] Model already exists. Skip."
    exit 0
fi

mkdir -p "${TARGET_DIR}"

(
flock -n 9 || {
    echo "[xtts-downloader] Another downloader is running..."
    exit 1
}

python3 <<PYTHON
import os
import sys
import time
from huggingface_hub import snapshot_download

target_dir = "${TARGET_DIR}"

repo_id = "coqui/XTTS-v2"

print(f"[xtts-downloader] downloading {repo_id}")
print(f"[xtts-downloader] target={target_dir}")

for attempt in range(3):
    try:
        snapshot_download(
            repo_id=repo_id,
            local_dir=target_dir,
            local_dir_use_symlinks=False,
            resume_download=True,
            ignore_patterns=[
                "*.msgpack",
                "*.safetensors.index.json"
            ]
        )

        open(os.path.join(target_dir, ".ready"), "w").close()

        print("[xtts-downloader] complete")
        sys.exit(0)

    except Exception as e:
        print(f"[xtts-downloader] attempt={attempt+1} failed: {e}")

        if attempt == 2:
            sys.exit(1)

        time.sleep(10)

PYTHON

) 9>"${LOCK_FILE}"