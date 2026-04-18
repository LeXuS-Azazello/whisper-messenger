FROM python:3.10-slim

RUN apt-get update && apt-get install -y ffmpeg wget curl unzip bzip2 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn python-multipart sherpa-onnx numpy

COPY entrypoint.sh .
COPY main.py .
RUN chmod +x entrypoint.sh

ENV MODEL_DIR=/app/models/whisper-tiny
ENV NUM_THREADS=4
ENV WHISPER_SECRET=changeme

# Pre-download models to bake them into the image
RUN mkdir -p "$MODEL_DIR" && \
    wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2 && \
    tar -jxvf sherpa-onnx-whisper-tiny.tar.bz2 -C "$MODEL_DIR" --strip-components=1 && \
    rm sherpa-onnx-whisper-tiny.tar.bz2

CMD ["./entrypoint.sh"]
