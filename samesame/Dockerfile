FROM python:3.10-slim

ENV TORCH_DISABLE_CUDA=1
ENV TORCHAUDIO_DISABLE_CUDA=1
ENV CUDA_VISIBLE_DEVICES=""
ENV DEBIAN_FRONTEND=noninteractive

# Системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libsndfile1 git build-essential unzip curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ModelScope для загрузки моделей
RUN pip install --no-cache-dir modelscope

# Клонируем CosyVoice
RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git . \
    && git submodule update --init --recursive

# Патч frontend.py: убираем whisper, заменяем на torchaudio
RUN python3 << 'PYEOF'
import pathlib
p = pathlib.Path('cosyvoice/cli/frontend.py')
t = p.read_text()
t = t.replace('import whisper', 'import torch\nimport torchaudio.transforms as T')
old = 'feat = whisper.log_mel_spectrogram(speech, n_mels=128)'
if old in t:
    new = 'mel_transform = T.MelSpectrogram(sample_rate=16000, n_mels=128, n_fft=400, hop_length=160)\n        feat = mel_transform(speech)\n        feat = torch.clamp(feat, min=1e-5).log2().unsqueeze(0)'
    t = t.replace(old, new)
    print("Patched frontend.py: whisper -> torchaudio")
else:
    print("WARNING: patch target not found in frontend.py")
p.write_text(t)
PYEOF

# Патч dataset/processor.py: убираем whisper
RUN python3 << 'PYEOF'
import pathlib
p = pathlib.Path('cosyvoice/dataset/processor.py')
if p.exists():
    t = p.read_text()
    t = t.replace('import whisper', '# import whisper  # patched')
    p.write_text(t)
    print("Patched dataset/processor.py")
PYEOF

# PyTorch CPU
RUN pip install --no-cache-dir --upgrade pip "setuptools<70.0.0" wheel
RUN pip install --no-cache-dir torch==2.3.1+cpu torchaudio==2.3.1+cpu -f https://download.pytorch.org/whl/torch_stable.html

# Зависимости CosyVoice (без GPU-мусора и без whisper)
RUN sed -i '/--extra-index-url/d' requirements.txt && \
    sed -i '/tensorrt-cu12/d' requirements.txt && \
    sed -i '/deepspeed/d' requirements.txt && \
    sed -i '/torch/d' requirements.txt && \
    sed -i '/torchaudio/d' requirements.txt && \
    sed -i '/openai-whisper/d' requirements.txt && \
    sed -i '/whisper/d' requirements.txt && \
    pip install --no-cache-dir -r requirements.txt

# Наш сервис
RUN pip install --no-cache-dir soundfile fastapi uvicorn pydantic

# Копируем app.py
COPY app.py ./

ENV PYTHONPATH="/app:/app/third_party/Matcha-TTS"
ENV SAMESAME_SECRET=changeme
ENV TTS_MODEL_DIR=/models
ENV HF_HOME=/models

EXPOSE 8002
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
