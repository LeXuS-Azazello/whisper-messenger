#!/bin/bash
# Скачивает модели sherpa-onnx при первом запуске
# Модели хранятся на PVC, скачиваются один раз
set -e

MODELS_DIR="${MODELS_DIR:-/models}"
mkdir -p "$MODELS_DIR"

BASE_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download"

echo ">>> Downloading SenseVoice-small model (~250MB)..."
mkdir -p "$MODELS_DIR/sense_voice"
if [ ! -f "$MODELS_DIR/sense_voice/model.onnx" ]; then
    curl -L -o "$MODELS_DIR/sense_voice/model.onnx" \
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2"
    # Альтернативная ссылка если выше не работает:
    # https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/main/model.int8.onnx
    echo ">>> SenseVoice downloaded."
fi

echo ">>> Downloading Silero VAD model (~2MB)..."
mkdir -p "$MODELS_DIR/vad"
if [ ! -f "$MODELS_DIR/vad/silero_vad.onnx" ]; then
    curl -L -o "$MODELS_DIR/vad/silero_vad.onnx" \
        "${BASE_URL}/asr-models/silero_vad.onnx"
    echo ">>> Silero VAD downloaded."
fi

echo ">>> Downloading CT-Transformer Punctuation model (~100MB)..."
mkdir -p "$MODELS_DIR/punctuation"
if [ ! -f "$MODELS_DIR/punctuation/model.onnx" ]; then
    curl -L -o /tmp/punct.tar.bz2 \
        "${BASE_URL}/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12.tar.bz2"
    tar -xjf /tmp/punct.tar.bz2 -C "$MODELS_DIR/punctuation" --strip-components=1
    rm /tmp/punct.tar.bz2
    echo ">>> Punctuation model downloaded."
fi

echo ">>> All models ready in $MODELS_DIR"
ls -lh "$MODELS_DIR"/*/
