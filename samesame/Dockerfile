FROM python:3.10-slim

# Полное отключение CUDA на уровне окружения
ENV TORCH_DISABLE_CUDA=1
ENV TORCHAUDIO_DISABLE_CUDA=1
ENV CUDA_VISIBLE_DEVICES=""
ENV DEBIAN_FRONTEND=noninteractive

# Установка системных зависимостей (включая библиотеки для сборки С-воркеров)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    git \
    build-essential \
    unzip \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Устанавливаем официальную библиотеку ModelScope
RUN pip install --no-cache-dir modelscope

# Клонируем CosyVoice сразу в текущую рабочую директорию (/app)
RUN git clone --depth 1 https://github.com/FunAudioLLM/CosyVoice.git . \
  && git submodule update --init --recursive

# # Патч frontend.py: заменяем whisper на torchaudio spectrogram

# RUN python3 << 'PYEOF'
# import pathlib
# p = pathlib.Path('cosyvoice/cli/frontend.py')
# t = p.read_text()
# # Заменяем импорт whisper на torchaudio спектрограммы
# t = t.replace('import whisper', 'import torchaudio.transforms as T')
# # Заменяем вызов whisper.log_mel_spectrogram(...)
# t = t.replace(
#     'feat = whisper.log_mel_spectrogram(speech, n_mels=128)',
#     'mel_transform = T.MelSpectrogram(sample_rate=16000, n_mels=128, n_fft=400, hop_length=160)\n        feat = mel_transform(speech).log2().unsqueeze(0)'
# )
# p.write_text(t)
# print("Patched frontend.py: whisper -> torchaudio")
# PYEOF

# Обновляем базовый менеджер пакетов
RUN pip install --no-cache-dir --upgrade pip "setuptools<70.0.0" wheel

# Установка чистых CPU версий PyTorch и TorchAudio
RUN pip install --no-cache-dir torch==2.3.1+cpu torchaudio==2.3.1+cpu -f https://download.pytorch.org/whl/torch_stable.html

# Очистка зависимостей CosyVoice от GPU/тяжелого мусора и установка
RUN sed -i '/--extra-index-url/d' requirements.txt && \
    sed -i '/tensorrt-cu12/d' requirements.txt && \
    sed -i '/deepspeed/d' requirements.txt && \
    sed -i '/torch/d' requirements.txt && \
    sed -i '/torchaudio/d' requirements.txt && \
    sed -i '/openai-whisper/d' requirements.txt && \
    pip install --no-cache-dir -r requirements.txt

# Установка пакетов, необходимых для нашего быстрого скрипта озвучки
RUN pip install --no-cache-dir faster-whisper soundfile fastapi uvicorn pydantic

# Install whisper package to satisfy CosyVoice3 dependency
RUN pip install --no-cache-dir git+https://github.com/openai/whisper.git

# Копируем ваш app.py (когда вы собираете контейнер локально)
COPY app.py ./

# Настройка путей для корректного импорта модулей CosyVoice
ENV PYTHONPATH="/app:/app/third_party/Matcha-TTS"

# Дефолтные переменные окружения (могут быть перезаписаны при docker run / k8s)
ENV SAMESAME_SECRET=changeme
ENV TTS_MODEL_DIR=/models
ENV HF_HOME=/models

EXPOSE 8002

# Запуск приложения (модуль app теперь железно лежит в /app/app.py)
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]
