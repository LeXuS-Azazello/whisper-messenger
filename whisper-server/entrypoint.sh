#!/bin/bash
if [ ! -f "$MODEL_DIR/tiny-tokens.txt" ] && [ ! -f "$MODEL_DIR/tokens.txt" ]; then
    echo "Downloading Whisper model..."
    mkdir -p "$MODEL_DIR"
    wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2
    tar -jxvf sherpa-onnx-whisper-tiny.tar.bz2 -C "$MODEL_DIR" --strip-components=1
    rm sherpa-onnx-whisper-tiny.tar.bz2
fi
exec uvicorn main:app --host 0.0.0.0 --port 8000
