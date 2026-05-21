#!/bin/sh
set -euo pipefail

MODELS_DIR="${MODELS_DIR:-/models}"

echo "[download-models] MODELS_DIR=$MODELS_DIR"
mkdir -p "$MODELS_DIR/sense_voice" "$MODELS_DIR/vad" "$MODELS_DIR/punctuation"

BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download"

download_if_missing() {
  local url="$1"
  local out="$2"

  if [ -f "$out" ]; then
    echo "[download-models] exists: $out"
    return 0
  fi

  echo "[download-models] downloading $url → $out"
  curl -L --fail --retry 5 --retry-delay 3 -o "$out" "$url"
}

download_tar_if_missing() {
  local url="$1"
  local dest_dir="$2"
  local marker="$3"

  if [ -f "$marker" ]; then
    echo "[download-models] exists: $marker"
    return 0
  fi

  echo "[download-models] downloading archive $url"
  tmp="$(mktemp)"
  curl -L --fail --retry 5 --retry-delay 3 -o "$tmp" "$url"
  tar -xjf "$tmp" -C "$dest_dir" --strip-components=1
  rm -f "$tmp"
}

# SenseVoice ASR model
download_tar_if_missing \
  "${BASE}/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2" \
  "$MODELS_DIR/sense_voice" \
  "$MODELS_DIR/sense_voice/model.int8.onnx"

# Silero VAD model
download_if_missing \
  "${BASE}/asr-models/silero_vad.onnx" \
  "$MODELS_DIR/vad/silero_vad.onnx"

# CT-Transformer punctuation model
download_tar_if_missing \
  "${BASE}/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12.tar.bz2" \
  "$MODELS_DIR/punctuation" \
  "$MODELS_DIR/punctuation/model.onnx"

# verify existence
if [ ! -f "$MODELS_DIR/sense_voice/model.int8.onnx" ] || [ ! -f "$MODELS_DIR/sense_voice/tokens.txt" ]; then
  echo "[download-models] ERROR: SenseVoice model files missing after download"
  exit 1
fi

if [ ! -f "$MODELS_DIR/vad/silero_vad.onnx" ]; then
  echo "[download-models] ERROR: Silero VAD model missing after download"
  exit 1
fi

if [ ! -f "$MODELS_DIR/punctuation/model.onnx" ] || [ ! -f "$MODELS_DIR/punctuation/vocab.txt" ]; then
  echo "[download-models] ERROR: Punctuation model files missing after download"
  exit 1
fi

echo "[download-models] done. models are ready in $MODELS_DIR"
