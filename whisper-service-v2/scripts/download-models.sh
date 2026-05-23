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
  if ! curl -L --fail --retry 12 --retry-delay 5 --max-time 1800 -o "$out" "$url"; then
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

echo "[download-models] >>> Whisper large-v3-turbo.int8 (strong multilingual + LID) ..."
mkdir -p "$MODELS_DIR/whisper"

# ---- Ensure git is installed (required for cloning from HuggingFace) ----
if ! command -v git >/dev/null 2>&1; then
  echo "[download-models] Installing git..."
  apt-get update && apt-get install -y git
fi
# ---- Install git‑xet (optional but recommended for large files) ----
curl -sSfL https://hf.co/git-xet/install.sh | sh || echo "[download-models] git‑xet install failed – continuing without it"

# ---- Install git‑lfs (required for large model files) ----
if ! command -v git-lfs >/dev/null 2>&1; then
  echo "[download-models] Installing git-lfs..."
  apt-get update && apt-get install -y git-lfs
fi
# Initialize and pull LFS objects
git lfs install --skip-repo
git lfs pull

# ---- Robust renaming of model files ----
# Encoder: prefer encoder_model_quantized.onnx, fallback to encoder.onnx
if [ -f "$MODELS_DIR/whisper/encoder_model_quantized.onnx" ]; then
  mv "$MODELS_DIR/whisper/encoder_model_quantized.onnx" "$MODELS_DIR/whisper/large-v3-turbo-encoder.int8.onnx"
elif [ -f "$MODELS_DIR/whisper/encoder.onnx" ]; then
  mv "$MODELS_DIR/whisper/encoder.onnx" "$MODELS_DIR/whisper/large-v3-turbo-encoder.int8.onnx"
fi
# Decoder: prefer decoder_model_quantized.onnx, fallback to decoder.onnx
if [ -f "$MODELS_DIR/whisper/decoder_model_quantized.onnx" ]; then
  mv "$MODELS_DIR/whisper/decoder_model_quantized.onnx" "$MODELS_DIR/whisper/large-v3-turbo-decoder.int8.onnx"
elif [ -f "$MODELS_DIR/whisper/decoder.onnx" ]; then
  mv "$MODELS_DIR/whisper/decoder.onnx" "$MODELS_DIR/whisper/large-v3-turbo-decoder.int8.onnx"
fi
# Tokens / vocab: prefer large‑v3‑turbo‑tokens.txt, fallback to vocab.txt
if [ ! -f "$MODELS_DIR/whisper/large-v3-turbo-tokens.txt" ]; then
  if [ -f "$MODELS_DIR/whisper/vocab.txt" ]; then
    mv "$MODELS_DIR/whisper/vocab.txt" "$MODELS_DIR/whisper/large-v3-turbo-tokens.txt"
  else
    for f in "$MODELS_DIR/whisper"/*.txt; do
      [ -f "$f" ] && mv "$f" "$MODELS_DIR/whisper/large-v3-turbo-tokens.txt" && break
    done
  fi
fi

# 2. Silero VAD
  download_if_missing \
    "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx" \
    "$MODELS_DIR/vad/silero_vad.onnx"

# 3. Punctuation (CT-Transformer) — OPTIONAL for best zh/en quality.
#    We now have excellent simple offline punctuation for 100+ languages without this model.
echo "[download-models] >>> Punctuation model is optional (simple fallback covers most languages)"
download_tar_if_missing \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/punctuation-models/sherpa-onnx-punct-ct-transformer-zh-en-vocab272727-2024-04-12-int8.tar.bz2" \
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
