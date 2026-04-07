#!/bin/bash
if [ ! -f "/app/models/paraformer/tokens.txt" ]; then
    echo "Downloading Paraformer model..."
    mkdir -p /app/models/paraformer
    cd /app/models/paraformer
    wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2
    tar xvf sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2
    mv sherpa-onnx-paraformer-zh-2023-09-14/* . || true
    rm -rf sherpa-onnx-paraformer-zh-2023-09-14 sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2
    cd /app
fi
exec node index.js
