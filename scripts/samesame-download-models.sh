#!/bin/sh
set -eu

MODELS_DIR="${MODELS_DIR:-/models}"
echo "[samesame-downloader] MODELS_DIR=$MODELS_DIR"
mkdir -p "$MODELS_DIR"
mkdir -p "$MODELS_DIR/hub"

export XDG_DATA_HOME="$MODELS_DIR"
export TRANSFORMERS_CACHE="$MODELS_DIR"
export MODELSCOPE_CACHE="$MODELS_DIR"

python3 -c "
import os
import sys

os.environ['CUDA_VISIBLE_DEVICES'] = ''
os.environ['OMP_NUM_THREADS'] = '2'
os.environ['MKL_NUM_THREADS'] = '2'

import torch
torch.set_num_threads(2)
torch.set_num_interop_threads(1)

MODELS_DIR = '$MODELS_DIR'
HUB_DIR = os.path.join(MODELS_DIR, 'hub')
os.makedirs(HUB_DIR, exist_ok=True)

MODELS_TO_DOWNLOAD = ['FunAudioLLM/Fun-CosyVoice3-0.5B-2512']

for model_name in MODELS_TO_DOWNLOAD:
    target_dir = os.path.join(HUB_DIR, model_name)
    print(f'[samesame-downloader] Checking {model_name} at {target_dir}...')
    if os.path.isdir(target_dir) and any(os.listdir(target_dir)):
        print(f'[samesame-downloader] {model_name} already exists. Skipping.')
        continue
    print(f'[samesame-downloader] Downloading {model_name}...')
    try:
        from modelscope import snapshot_download
        snapshot_download(model_name, cache_dir=HUB_DIR)
        print(f'[samesame-downloader] {model_name} complete.')
    except Exception as e:
        print(f'[samesame-downloader] Error: {e}')
        sys.exit(1)
"