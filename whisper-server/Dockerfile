FROM python:3.10-slim

RUN apt-get update && apt-get install -y ffmpeg wget curl unzip bzip2 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn python-multipart sherpa-onnx numpy

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV MODEL_DIR=/app/models/whisper-tiny
ENV NUM_THREADS=4
ENV WHISPER_SECRET=changeme

CMD ["./entrypoint.sh"]
