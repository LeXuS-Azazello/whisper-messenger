# Dockerfile — whisper-service
# Pre-downloads openai/whisper-large-v3-turbo into the image at build time
# so the model is available at runtime without any network access.

FROM harbor.dev.takatan.cloud/devcenter/python:3.12-slim

WORKDIR /app

# ── System deps ──────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ── Python deps ──────────────────────────────────────────────────────────────
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        torch torchaudio --index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir \
        "transformers==4.45.2" "accelerate==1.0.0" \
        python-multipart uvicorn fastapi pydantic \
        huggingface-hub psutil \
        "librosa==0.10.2.post1" "soundfile==0.12.1" \
        "hf-transfer==0.1.9" \
    && rm -rf /root/.cache/pip

# ── HF cache dir (PVC volume mount at runtime) ──────────────────────────────
ENV HF_HOME=/hf-cache
ENV HF_HUB_ENABLE_HF_TRANSFER=1
ENV TRANSFORMERS_NO_ADVISORY_WARNINGS=1
ENV HF_LOCAL_FILES_ONLY=false
RUN mkdir -p /hf-cache

# ── Pre-download the model into /hf-cache at build time ─────────────────────
COPY download_model.py /tmp/
RUN python3 /tmp/download_model.py /hf-cache \
    && rm /tmp/download_model.py

# ── App source ───────────────────────────────────────────────────────────────
COPY app.py input_schema.py ./

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app /hf-cache

USER appuser

EXPOSE 8000
CMD ["python3", "/app/app.py"]
