# Use slim Python image
FROM python:3.10-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch CPU first to avoid massive GPU dependencies
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Install FunASR, ModelScope, and FastAPI
RUN pip install --no-cache-dir \
    funasr==1.1.9 \
    fastapi uvicorn[standard] python-multipart modelscope

# Copy server implementation
COPY server.py /app/server.py
WORKDIR /app

# Expose port 50001 (matches previous usage)
EXPOSE 50001

# Run the API server
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "50001"]
