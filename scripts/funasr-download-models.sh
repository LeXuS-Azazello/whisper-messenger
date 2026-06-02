#!/bin/bash
set -e

# Берём пути и имена из переменных окружения (задаются в K8s Job)
MODELS_DIR=${MODELS_DIR:-/models}
MODEL_NAME=${FUNASR_MODEL_NAME:-"FunAudioLLM/Fun-ASR-MLT-Nano-2512"}
VAD_MODEL_NAME=${FUNASR_VAD_MODEL:-"iic/speech_fsmn_vad_zh-cn-16k-common-pytorch"}
PUNC_MODEL_NAME=${FUNASR_PUNC_MODEL:-"iic/punc_ct-transformer_cn-en-common-vocab471067-large"}

echo "=== Starting FunASR Downloader ==="
echo "Target directory: $MODELS_DIR"
mkdir -p "$MODELS_DIR"

python3 -c "
import os
import sys

models = [
    ('main', '$MODEL_NAME'),
    ('vad', '$VAD_MODEL_NAME'),
    ('punc', '$PUNC_MODEL_NAME'),
]

base_dir = '$MODELS_DIR'

for label, model_id in models:
    # Вычисляем финальный путь, куда ModelScope положит файлы
    # Например: /models/FunAudioLLM/Fun-ASR-MLT-Nano-2512
    target_path = os.path.join(base_dir, model_id)
    
    # Защита от повторного скачивания: если папка есть и она не пустая
    if os.path.isdir(target_path) and os.listdir(target_path):
        print(f'[+] {label} ({model_id}) already exists. Skipping download.')
        continue

    print(f'Downloading {label}: {model_id}...')
    
    # Попытка 1: ModelScope
    try:
        from modelscope import snapshot_download as ms_download
        ms_download(model_id, cache_dir=base_dir)
        print(f'  {label} downloaded via ModelScope.')
        continue
    except Exception as e:
        print(f'  ModelScope failed for {label}: {e}. Trying HuggingFace...')

    # Попытка 2: HuggingFace Hub (Фолбек)
    try:
        from huggingface_hub import snapshot_download as hf_download
        # Для HF принудительно указываем точный локальный путь, воссоздавая структуру ModelScope
        hf_download(repo_id=model_id, local_dir=target_path, local_dir_use_symlinks=False)
        print(f'  {label} downloaded via HuggingFace.')
    except Exception as e:
        print(f'[CRITICAL] All download sources failed for {label}: {e}')
        sys.exit(1)

print('All models processed.')
"

echo "----------------------------------------"
echo "Verifying downloads inside $MODELS_DIR..."
echo "----------------------------------------"

# Исправленная верификация: ищем папки внутри $MODELS_DIR
if [ -d "$MODELS_DIR/$MODEL_NAME" ] && [ "$(ls -A "$MODELS_DIR/$MODEL_NAME")" ]; then
    echo "✅ Main model verification: OK ($MODELS_DIR/$MODEL_NAME)"
else
    echo "❌ Main model verification: FAILED" && exit 1
fi

if [ -d "$MODELS_DIR/$VAD_MODEL_NAME" ] && [ "$(ls -A "$MODELS_DIR/$VAD_MODEL_NAME")" ]; then
    echo "✅ VAD model verification: OK ($MODELS_DIR/$VAD_MODEL_NAME)"
else
    echo "❌ VAD model verification: FAILED" && exit 1
fi

if [ -d "$MODELS_DIR/$PUNC_MODEL_NAME" ] && [ "$(ls -A "$MODELS_DIR/$PUNC_MODEL_NAME")" ]; then
    echo "✅ Punc model verification: OK ($MODELS_DIR/$PUNC_MODEL_NAME)"
else
    echo "❌ Punc model verification: FAILED" && exit 1
fi

echo "=== Downloader Execution Successful ==="
