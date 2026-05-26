FROM python:3.10-slim
ENV TORCH_DISABLE_CUDA=1
ENV TORCHAUDIO_DISABLE_CUDA=1
ENV CUDA_VISIBLE_DEVICES=

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    build-essential \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git

RUN cd CosyVoice && \
    git submodule update --init --recursive && \
    # Safe import of torchaudio for CPU-only environments\
    sed -i '1i# Safe import of torchaudio for CPU-only environments\
try:\
    import torchaudio.compliance.kaldi as kaldi\
except Exception:\
    kaldi = None' cosyvoice/cli/frontend.py

# Note: we use CPU versions and bypass broken wheels (like older openai-whisper)
RUN pip install --upgrade pip "setuptools<70.0.0" wheel && \
    pip install --no-cache-dir torch==2.3.1+cpu torchaudio==2.3.1+cpu -f https://download.pytorch.org/whl/torch_stable.html && \
    cd CosyVoice && \
    sed -i '/--extra-index-url/d' requirements.txt && \
    sed -i '/onnxruntime-gpu/d' requirements.txt && \
    sed -i '/tensorrt-cu12/d' requirements.txt && \
    sed -i '/deepspeed/d' requirements.txt && \
    sed -i '/torch/d' requirements.txt && \
    sed -i '/torchaudio/d' requirements.txt && \
    sed -i '/openai-whisper/d' requirements.txt && \
    pip install --no-cache-dir onnxruntime && \
    pip install --no-cache-dir --no-build-isolation openai-whisper==20231117 && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir fastapi uvicorn pydantic

COPY app.py download_model.py ./
ENV PYTHONPATH="/app/CosyVoice:/app/CosyVoice/third_party/Matcha-TTS"

ENV SAMESAME_SECRET=changeme
ENV TTS_MODEL_DIR=/models
ENV HF_HOME=/models
EXPOSE 8002
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
