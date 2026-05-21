# ─────────────────────────────────────────────────────────────────────────────
# Translation Service — NLLB-200-distilled-600M
# CTranslate2 INT8 ~300MB модель, 200+ языков, полностью offline
# НЕ СОБИРАТЬ ЛОКАЛЬНО — деплой через remote build
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

# CTranslate2 значительно легче чем PyTorch
RUN pip install --no-cache-dir \
        ctranslate2 \
        sentencepiece \
        "huggingface-hub>=0.23.0" \
        fastapi uvicorn pydantic \
    && rm -rf /root/.cache/pip

ENV HF_HOME=/hf-cache
ENV HF_HUB_ENABLE_HF_TRANSFER=0
ENV HF_LOCAL_FILES_ONLY=false
ENV NUM_THREADS=4
ENV INTER_THREADS=2

RUN mkdir -p /hf-cache

# Предзагрузка модели при сборке образа (на сервере!)
COPY download_model.py /tmp/
RUN python3 /tmp/download_model.py && rm /tmp/download_model.py

COPY app.py ./

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /hf-cache
USER appuser

EXPOSE 8001
CMD ["python3", "app.py"]
