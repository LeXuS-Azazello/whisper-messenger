FROM python:3.10-slim
WORKDIR /app
COPY server.py download_model.py ./
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir funasr==1.3.9 fastapi uvicorn[standard] python-multipart modelscope huggingface_hub "numpy<2"
EXPOSE 50001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "50001"]
