#!/bin/bash
set -e

MODEL=""
CACHE_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --model)
      MODEL="$2"
      shift 2
      ;;
    --cache_dir)
      CACHE_DIR="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "$MODEL" ] || [ -z "$CACHE_DIR" ]; then
  echo "Usage: $0 --model <model_id> --cache_dir <cache_dir>"
  exit 1
fi

echo "Downloading model $MODEL to $CACHE_DIR"
modelscope download --model "$MODEL" --cache_dir "$CACHE_DIR"
echo "Model download complete."
