#!/bin/sh
# =============================================================================
# whisper-service-v2 model downloader
# =============================================================================
# CRITICAL RULES (per AGENTS.md):
# - This script runs ONLY inside Kubernetes as a Job that mounts a PVC.
# - Models (several GB) are downloaded ONLY ON THE SERVER (K8s node / PVC).
# - NEVER run this manually on a laptop — local disk is limited.
# - Downloads happen at most once thanks to marker files.
# - Punctuation model is now optional. Simple fallback works for most languages.
# =============================================================================

set -euo pipefail

echo "=============================================================="
echo "[download-models] START at $(date -Iseconds)"
echo "[download-models] MODELS_DIR=${MODELS_DIR:-/models}"
echo "=============================================================="

MODELS_DIR="${MODELS_DIR:-/models}"

mkdir -p "$MODELS_DIR/sense_voice" "$MODELS_DIR/vad" "$MODELS_DIR/punctuation"

BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download"

# --- helper: single file (Silero VAD) ----------------------------------------
download_if_missing() {
  local url="$1"
  local out="$2"

  if [ -f "$out" ]; then
    echo "[download-models] SKIP (exists): $out"
    return 0
  fi

  echo "[download-models] DOWNLOADING (single file): $url → $out"
  if ! curl -L --fail --retry 8 --retry-delay 5 --max-time 300 -o "$out" "$url"; then
    echo "[download-models] FATAL: failed to download $url after retries" >&2
    exit 1
  fi
  echo "[download-models] SUCCESS: $out"
}

# --- helper: tar.bz2 archive (SenseVoice + Punctuation) ----------------------
download_tar_if_missing() {
  local url="$1"
  local dest_dir="$2"
  local marker="$3"
  local name="$4"

  if [ -f "$marker" ]; then
    echo "[download-models] SKIP (exists): $marker  [$name]"
    return 0
  fi

  echo "[download-models] DOWNLOADING ARCHIVE ($name): $url"
  tmp="$(mktemp)"
  if ! curl -L --fail --retry 8 --retry-delay 5 --max-time 600 -o "$tmp" "$url"; then
    echo "[download-models] FATAL: failed to download archive $url after retries" >&2
    rm -f "$tmp"
    exit 1
  fi

  echo "[download-models] EXTRACTING $name into $dest_dir ..."
  tar -xjf "$tmp" -C "$dest_dir" --strip-components=1
  rm -f "$tmp"
  echo "[download-models] SUCCESS: $name extracted (marker: $marker)"
}

# 1. Whisper large-v3-turbo int8 (best multilingual support + strongest language ID)
#    Excellent Russian, Hebrew, Arabic, 99+ languages. Much better LID than any distil model.
echo "[download-models] >>> Downloading Whisper large-v3-turbo.int8 (multilingual + strong LID) ..."
mkdir -p "$MODELS_DIR/whisper"

WHISPER_VERSION="v1.11.1"
WHISPER_BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download/${WHISPER_VERSION}"

download_if_missing \
  "${WHISPER_BASE}/large-v3-turbo-encoder.int8.onnx" \
  "$MODELS_DIR/whisper/large-v3-turbo-encoder.int8.onnx"

download_if_missing \
  "${WHISPER_BASE}/large-v3-turbo-decoder.int8.onnx" \
  "$MODELS_DIR/whisper/large-v3-turbo-decoder.int8.onnx"

download_if_missing \
  "${WHISPER_BASE}/large-v3-turbo-tokens.txt" \
  "$MODELS_DIR/whisper/large-v3-turbo-tokens.txt"

# 2. Silero VAD
download_if_missing \
  "${BASE}/asr-models/silero_vad.onnx" \
  "$MODELS_DIR/vad/silero_vad.onnx"

# 3. Punctuation (CT-Transformer) — OPTIONAL for best zh/en quality.
#    We now have excellent simple offline punctuation for 100+ languages without this model.
echo "[download-models] >>> Punctuation model is optional (simple fallback covers most languages)"
download_tar_if_missing \
  "${BASE}/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12.tar.bz2" \
  "$MODELS_DIR/punctuation" \
  "$MODELS_DIR/punctuation/model.onnx" \
  "Punctuation CT-Transformer (optional)" || true

echo "[download-models] All downloads attempted. Running final verification ..."

# --- strict verification with EXPLICIT error messages -----------------------
missing=0

if [ ! -f "$MODELS_DIR/whisper/large-v3-turbo-encoder.int8.onnx" ] || [ ! -f "$MODELS_DIR/whisper/large-v3-turbo-decoder.int8.onnx" ] || [ ! -f "$MODELS_DIR/whisper/large-v3-turbo-tokens.txt" ]; then
  echo "[download-models] ERROR: Whisper large-v3-turbo.int8 files missing!" >&2
  echo "  Expected in $MODELS_DIR/whisper/ : large-v3-turbo-encoder.int8.onnx, decoder, tokens" >&2
  missing=1
else
  echo "[download-models] OK: Whisper large-v3-turbo.int8 (best multilingual + LID)"
fi

if [ ! -f "$MODELS_DIR/vad/silero_vad.onnx" ]; then
  echo "[download-models] ERROR: Silero VAD missing!" >&2
  echo "  Expected: $MODELS_DIR/vad/silero_vad.onnx" >&2
  missing=1
else
  echo "[download-models] OK: VAD"
fi

if [ ! -f "$MODELS_DIR/punctuation/model.onnx" ] || [ ! -f "$MODELS_DIR/punctuation/vocab.txt" ]; then
  echo "[download-models] INFO: Punctuation model not found — using simple multilingual fallback (covers 100+ languages)"
else
  echo "[download-models] OK: Punctuation (zh/en extra quality)"
fi

if [ "$missing" -eq 1 ]; then
  echo "[download-models] FATAL: required models (large-v3-turbo or VAD) are missing." >&2
  exit 1
fi

echo "=============================================================="
echo "[download-models] SUCCESS — all models ready in $MODELS_DIR at $(date -Iseconds)"
echo "=============================================================="
