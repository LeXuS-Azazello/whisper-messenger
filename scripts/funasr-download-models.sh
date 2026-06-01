#!/bin/bash
set -e

MODELS_DIR=${MODELS_DIR:-/models}
MODEL_NAME=${FUNASR_MODEL_NAME:-"FunAudioLLM/Fun-ASR-MLT-Nano-2512"}
VAD_MODEL_NAME=${FUNASR_VAD_MODEL:-"iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"}
PUNC_MODEL_NAME=${FUNASR_PUNC_MODEL:-"iic/punc_ct-transformer_cn-en-common-vocab471067-large"}

echo "Downloading FunASR models to $MODELS_DIR..."
mkdir -p "$MODELS_DIR"

python3 -c "
from modelscope import snapshot_download
import os

models = [
    ('main', '$MODEL_NAME'),
    ('vad', '$VAD_MODEL_NAME'),
    ('punc', '$PUNC_MODEL_NAME'),
]

for label, model_id in models:
    print(f'Downloading {label}: {model_id}...')
    try:
        snapshot_download(model_id, cache_dir='$MODELS_DIR')
        print(f'  {label} done.')
    except Exception as e:
        print(f'  {label} error: {e}')
        exit(1)

print('All models downloaded successfully.')
"

echo "Verifying downloads..."
ls -la "$MODEL_NAME" 2>/dev/null && echo "Main model OK"
ls -la "$VAD_MODEL_NAME" 2>/dev/null && echo "VAD model OK"
ls -la "$PUNC_MODEL_NAME" 2>/dev/null && echo "Punc model OK"

echo "Done."
