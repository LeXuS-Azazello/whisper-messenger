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

mkdir -p "$MODELS_DIR/whisper" "$MODELS_DIR/vad"

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

# --- helper: tar.bz2 archive (Whisper turbo etc.) ----------------------------
download_tar_if_missing() {
  local url="$1"
  local dest_dir="$2"
  local marker="$3"
  local name="$4"

  if [ -f "$marker" ]; then
    size=$(stat -c%s "$marker" 2>/dev/null || echo 0)
    if [ "$size" -gt 100000000 ]; then
      echo "[download-models] SKIP (exists and valid, ${size} bytes): $marker  [$name]"
      return 0
    else
      echo "[download-models] WARNING: $marker exists but too small (${size} bytes) — will re-download"
      rm -f "$marker"
    fi
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
  find "$dest_dir" -mindepth 2 -type f -exec mv {} "$dest_dir"/ \; 2>/dev/null || true
  find "$dest_dir" -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
  rm -f "$tmp"
  echo "[download-models] SUCCESS: $name extracted (marker: $marker)"
}

# 1. Whisper large-v3-turbo int8 — official sherpa-onnx export
#    Best quality + LID for 99+ languages (Russian, Hebrew, Arabic, etc.)
echo "[download-models] >>> Downloading Whisper turbo int8 (large-v3-turbo) ..."
download_tar_if_missing \
  "${BASE}/asr-models/sherpa-onnx-whisper-turbo.tar.bz2" \
  "$MODELS_DIR/whisper" \
  "$MODELS_DIR/whisper/turbo-encoder.int8.onnx" \
  "Whisper turbo int8 (large-v3-turbo)"

# 2. Silero VAD (required for voice activity detection)
#    Direct single-file download as requested
download_if_missing \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx" \
  "$MODELS_DIR/vad/silero_vad.onnx"

# 3. English Online Punctuation + Truecasing (cnn-bilstm, very small + high quality for English)
echo "[download-models] >>> Downloading English punctuation (online cnn-bilstm int8) ..."
download_tar_if_missing \
  "${BASE}/punctuation-models/sherpa-onnx-online-punct-en-2024-08-06.tar.bz2" \
  "$MODELS_DIR/punctuation" \
  "$MODELS_DIR/punctuation/model.int8.onnx" \
  "English Online Punctuation + Truecase (int8)"

echo "[download-models] All downloads attempted. Running final verification ..."

# --- strict verification ----------------------------------------------------
missing=0

if [ ! -f "$MODELS_DIR/whisper/turbo-encoder.int8.onnx" ] || \
   [ ! -f "$MODELS_DIR/whisper/turbo-decoder.int8.onnx" ] || \
   ( [ ! -f "$MODELS_DIR/whisper/tokens.txt" ] && [ ! -f "$MODELS_DIR/whisper/turbo-tokens.txt" ] ); then
  echo "[download-models] ERROR: Whisper turbo int8 files missing!" >&2
  echo "  Expected in $MODELS_DIR/whisper/ : turbo-encoder.int8.onnx, turbo-decoder.int8.onnx, tokens.txt or turbo-tokens.txt" >&2
  missing=1
else
  echo "[download-models] OK: Whisper turbo int8 (large-v3-turbo)"
fi

if [ ! -f "$MODELS_DIR/vad/silero_vad.onnx" ]; then
  echo "[download-models] ERROR: Silero VAD missing!" >&2
  echo "  Expected: $MODELS_DIR/vad/silero_vad.onnx" >&2
  missing=1
else
  echo "[download-models] OK: VAD"
fi

if [ -f "$MODELS_DIR/punctuation/model.int8.onnx" ] && [ -f "$MODELS_DIR/punctuation/bpe.vocab" ]; then
  echo "[download-models] OK: Punctuation (English cnn-bilstm int8 + truecasing)"
elif [ -f "$MODELS_DIR/punctuation/model.onnx" ] && [ -f "$MODELS_DIR/punctuation/bpe.vocab" ]; then
  echo "[download-models] OK: Punctuation (English cnn-bilstm)"
else
  echo "[download-models] INFO: No punctuation model found — using simple multilingual fallback (100+ langs)"
fi

if [ "$missing" -eq 1 ]; then
  echo "[download-models] FATAL: required models (turbo or VAD) are missing." >&2
  exit 1
fi

echo "=============================================================="
echo "[download-models] SUCCESS — all models ready in $MODELS_DIR at $(date -Iseconds)"
echo "=============================================================="