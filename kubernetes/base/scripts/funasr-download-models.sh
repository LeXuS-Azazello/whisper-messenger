#!/bin/bash
set -e

MODELS_DIR=${MODELS_DIR:-/models}
MODEL_NAME=${SAMESAME_MODEL_NAME:-"FunAudioLLM/Fun-ASR-MLT-Nano-2512"}

echo "Downloading FunASR model: $MODEL_NAME to $MODELS_DIR..."

# Ensure models directory exists
mkdir -p "$MODELS_DIR"

# Use modelscope or huggingface depending on the environment
# Since we are using FunASR, we typically use modelscope or a specific downloader
# For this job, we'll use a python script to handle the download to ensure it's correct
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

echo "FunASR models downloaded successfully."
