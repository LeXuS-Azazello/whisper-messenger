#!/bin/sh
set -eu

MODELS_DIR="${MODELS_DIR:-/models}"
echo "[download-models] START at $(date -Iseconds)"
echo "[download-models] MODELS_DIR=$MODELS_DIR"
mkdir -p "$MODELS_DIR"

BASE="https://github.com/k2-fsa/sherpa-onnx/releases/download"

# Helper for direct downloads
download_if_missing() {
  local url="$1"
  local dest="$2"
  if [ ! -f "$dest" ]; then
    echo "[download-models] DOWNLOADING (single file): $url → $dest"
    mkdir -p "$(dirname "$dest")"
    local tmp="${dest}.tmp.$$"
    if ! curl -L --fail --retry 8 --retry-delay 5 --max-time 600 -o "$tmp" "$url"; then
      echo "[download-models] FATAL: failed to download $url after retries" >&2
      rm -f "$tmp"
      exit 1
    fi
    mv "$tmp" "$dest"
    echo "[download-models] SUCCESS: $dest"
  else
    echo "[download-models] SKIP (exists): $dest"
  fi
}

# Helper for tar.bz2 archives with validation
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
  mkdir -p "$dest_dir"
  local tmp="${dest_dir}/temp_archive_$$.tar.bz2"
  
  if ! curl -L --fail --retry 8 --retry-delay 5 --max-time 600 -o "$tmp" "$url"; then
    echo "[download-models] FATAL: failed to download archive $url after retries" >&2
    rm -f "$tmp"
    exit 1
  fi

  echo "[download-models] EXTRACTING $name into $dest_dir ..."
  mkdir -p "$dest_dir"
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

# 3. SenseVoice int8 (FunAudioLLM)
echo "[download-models] >>> Downloading SenseVoice int8 ..."
download_tar_if_missing \
  "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2" \
  "$MODELS_DIR/sensevoice" \
  "$MODELS_DIR/sensevoice/model.int8.onnx" \
  "SenseVoice (zh-en-ja-ko-yue)"

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
  echo "[download-models] ERROR: Missing or incomplete Whisper model" >&2
  missing=1
fi

if [ ! -f "$MODELS_DIR/vad/silero_vad.onnx" ]; then
  echo "[download-models] ERROR: Missing Silero VAD" >&2
  missing=1
fi

if [ "$missing" -eq 1 ]; then
  echo "[download-models] FATAL: Missing critical files. Downloader failed." >&2
  exit 1
fi

echo "[download-models] All critical models verified successfully."
exit 0