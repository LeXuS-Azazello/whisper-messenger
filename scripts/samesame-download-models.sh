#!/bin/bash
set -e

MODELS_DIR=${MODELS_DIR:-/models}
MODEL_NAME=${SAMESAME_MODEL_NAME:-"FunAudioLLM/Fun-CosyVoice3-0.5B-2512"}

echo "Downloading Samesame model: $MODEL_NAME to $MODELS_DIR..."

mkdir -p "$MODELS_DIR"

python3 -c "
from modelscope import snapshot_download
import os

model_id = '$MODEL_NAME'
cache_dir = '$MODELS_DIR'

print(f'Downloading {model_id} to {cache_dir}...')
try:
    snapshot_download(model_id, cache_dir=cache_dir)
    print('Download completed successfully.')
except Exception as e:
    print(f'Error downloading model: {e}')
    exit(1)
"

echo "Samesame models downloaded successfully."
