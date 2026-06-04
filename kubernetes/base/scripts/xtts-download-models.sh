#!/bin/sh
set -eu

MODELS_DIR="${MODELS_DIR:-/models}"
echo "[xtts-downloader] MODELS_DIR=$MODELS_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "$MODELS_DIR/.local/share/tts"

export XDG_DATA_HOME="$MODELS_DIR"
export TRANSFORMERS_CACHE="$MODELS_DIR"
export HF_HOME="$MODELS_DIR"

python3 -c "
import os
import sys

MODELS_DIR = '$MODELS_DIR'

# Set env for TOS
os.environ['COQUI_TOS_AGREED'] = '1'

# XTTS-v2 model (multilingual)
model_name = 'tts_models/multilingual/multi-dataset/xtts_v2'
print(f'[xtts-downloader] Downloading {model_name}...')

try:
    from TTS.utils.manage import download_model
    model_path, config_path, model_item = download_model(model_name)
    print(f'[xtts-downloader] {model_name} complete at {model_path}')
except Exception as e:
    print(f'[xtts-downloader] Error downloading {model_name}: {e}')
    sys.exit(1)
"