FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
    ctranslate2 \
    sentencepiece \
    fastapi uvicorn pydantic

ENV HF_HOME=/hf-cache
ENV MODEL_PATH=/hf-cache/facebook/nllb-200-distilled-600M
ENV NUM_THREADS=4
ENV INTER_THREADS=2

RUN mkdir -p /hf-cache

COPY app.py ./

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /hf-cache
USER appuser

EXPOSE 8001
CMD ["python3", "app.py"]
