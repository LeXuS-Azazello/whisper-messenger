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

# Безопасный патч импорта torchaudio для CPU окружений (без ломающих Docker переносов строк)
RUN sed -i '1i\try:\n    import torchaudio.compliance.kaldi as kaldi\nexcept Exception:\n    kaldi = None' cosyvoice/cli/frontend.py

# Обновляем базовый менеджер пакетов
RUN pip install --no-cache-dir --upgrade pip "setuptools<70.0.0" wheel

# Установка чистых CPU версий PyTorch и TorchAudio
RUN pip install --no-cache-dir torch==2.3.1+cpu torchaudio==2.3.1+cpu -f https://download.pytorch.org/whl/torch_stable.html

# Очистка зависимостей CosyVoice от GPU/тяжелого мусора и установка
RUN sed -i '/--extra-index-url/d' requirements.txt && \
    sed -i '/onnxruntime-gpu/d' requirements.txt && \
    sed -i '/tensorrt-cu12/d' requirements.txt && \
    sed -i '/deepspeed/d' requirements.txt && \
    sed -i '/torch/d' requirements.txt && \
    sed -i '/torchaudio/d' requirements.txt && \
    sed -i '/openai-whisper/d' requirements.txt && \
    pip install --no-cache-dir onnxruntime && \
    pip install --no-cache-dir -r requirements.txt

# Установка пакетов, необходимых для нашего быстрого скрипта озвучки
RUN pip install --no-cache-dir faster-whisper soundfile fastapi uvicorn pydantic

# Создаем ПРАВИЛЬНЫЙ download_model.py прямо внутри образа
RUN echo 'import os, sys\n\
os.environ["CUDA_VISIBLE_DEVICES"] = ""\n\
MODELS_DIR = sys.argv[1] if len(sys.argv) > 1 else "/models"\n\
MODEL_NAME = os.environ.get("SAMESAME_MODEL_NAME", "FunAudioLLM/Fun-CosyVoice3-0.5B-2512")\n\
TARGET_DIR = os.path.join(MODELS_DIR, MODEL_NAME)\n\
print(f"Downloading model {MODEL_NAME} to {TARGET_DIR}...")\n\
try:\n\
    from modelscope import snapshot_download\n\
    snapshot_download(MODEL_NAME, local_dir=TARGET_DIR)\n\
    print("Download complete successfully.")\n\
except Exception as e:\n\
    print(f"Error downloading model via modelscope: {e}")\n\
    sys.exit(1)' > /app/download_model.py

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
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
