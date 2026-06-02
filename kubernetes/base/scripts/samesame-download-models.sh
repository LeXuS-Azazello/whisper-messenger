#!/bin/sh
set -eu

MODELS_DIR="${MODELS_DIR:-/models}"
echo "[samesame-downloader] MODELS_DIR=$MODELS_DIR"
mkdir -p "$MODELS_DIR"

export XDG_DATA_HOME="$MODELS_DIR"
export TRANSFORMERS_CACHE="$MODELS_DIR"

python /app/download_model.py "$MODELS_DIR"
