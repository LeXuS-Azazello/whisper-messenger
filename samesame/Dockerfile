FROM python:3.10-slim

ENV DEBIAN_FRONTEND=noninteractive \
    TORCH_DISABLE_CUDA=1 \
    TORCHAUDIO_DISABLE_CUDA=1 \
    CUDA_VISIBLE_DEVICES="" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/models \
    TTS_MODEL_DIR=/models \
    PYTHONPATH="/app:/app/third_party/Matcha-TTS"

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    curl \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first
RUN pip install --no-cache-dir --upgrade \
    pip \
    "setuptools<70" \
    wheel

# CPU-only PyTorch
RUN pip install --no-cache-dir \
    torch==2.3.1+cpu \
    torchaudio==2.3.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

# Required tools
RUN pip install --no-cache-dir \
    modelscope \
    soundfile \
    fastapi \
    uvicorn \
    pydantic \
    tiktoken

# Clone repo + submodules
RUN git clone --recursive --depth 1 \
    https://github.com/FunAudioLLM/CosyVoice.git .

# Verify required dirs exist
RUN test -d third_party/Matcha-TTS

# Remove problematic deps from requirements
RUN sed -i '/--extra-index-url/d' requirements.txt && \
    sed -i '/tensorrt-cu12/d' requirements.txt && \
    sed -i '/deepspeed/d' requirements.txt && \
    sed -i '/torch/d' requirements.txt && \
    sed -i '/torchaudio/d' requirements.txt && \
    sed -i '/openai-whisper/d' requirements.txt && \
    sed -i '/whisper/d' requirements.txt

# Install project deps
RUN pip install --no-cache-dir -r requirements.txt

# Override vendored frontend.py (whisper-free, fixed ONNX dims)
COPY cosyvoice-cli-frontend.py /app/cosyvoice/cli/frontend.py

# ---------- PATCH processor.py ----------
RUN python3 <<'PYEOF'
from pathlib import Path

p = Path("cosyvoice/dataset/processor.py")

if p.exists():
    txt = p.read_text(encoding="utf-8")
    txt = txt.replace(
        "import whisper",
        "# import whisper (patched)"
    )
    p.write_text(txt, encoding="utf-8")
    print("processor.py patched")
PYEOF

# ---------- PATCH tokenizer.py ----------
RUN python3 <<'PYEOF'
from pathlib import Path

p = Path("cosyvoice/tokenizer/tokenizer.py")

if p.exists():
    txt = p.read_text(encoding="utf-8")

    target = "from whisper.tokenizer import Tokenizer"

    if target in txt:
        replacement = '''
class Tokenizer:
    def __init__(
        self,
        encoding,
        num_languages=99,
        language=None,
        task=None
    ):
        self.encoding = encoding
        self.num_languages = num_languages
        self.language = language
        self.task = task
'''

        txt = txt.replace(target, replacement)

    p.write_text(txt, encoding="utf-8")
    print("tokenizer.py patched")
PYEOF

# Create model cache dir
RUN mkdir -p /models

# Copy API
COPY app.py /app/app.py

# Cleanup build garbage
RUN apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /root/.cache/pip

ENV SAMESAME_SECRET=""

EXPOSE 8002

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
CMD curl -f http://localhost:8002/docs || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
