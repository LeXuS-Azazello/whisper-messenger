FROM python:3.10-slim

RUN apt-get update && apt-get install -y ffmpeg wget curl unzip bzip2 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn python-multipart sherpa-onnx numpy

# Download and extract the Whisper model (multilingual tiny)
RUN mkdir -p models/whisper-tiny && \
    wget https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-tiny.tar.bz2 && \
    tar -jxvf sherpa-onnx-whisper-tiny.tar.bz2 -C models/whisper-tiny --strip-components=1 && \
    rm sherpa-onnx-whisper-tiny.tar.bz2

COPY main.py .

ENV MODEL_DIR=/app/models/whisper-tiny
ENV NUM_THREADS=4
ENV WHISPER_SECRET=changeme

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
