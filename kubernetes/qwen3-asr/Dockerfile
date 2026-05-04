FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
# Using a single RUN to keep image layers clean
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    transformers \
    torch \
    librosa \
    soundfile \
    qwen-asr

# Copy server script
COPY server.py .

# Model will be downloaded at runtime to the cache volume
# We set TRANSFORMERS_CACHE to point to our persistent volume
ENV TRANSFORMERS_CACHE=/root/.cache
ENV MODEL_NAME="Qwen/Qwen3-ASR-0.6B"

EXPOSE 11434

CMD ["python", "server.py"]
