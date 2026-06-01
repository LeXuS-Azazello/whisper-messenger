FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir modelscope

RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /models

COPY modelscope-download.sh /modelscope-download.sh

RUN chmod +x /modelscope-download.sh

CMD ["/modelscope-download.sh", "--model", "FunAudioLLM/Fun-ASR-MLT-Nano-2512", "--cache_dir", "/models"]