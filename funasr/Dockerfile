FROM python:3.10-slim
WORKDIR /app
COPY server.py requirements.txt ./
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg libsndfile1 git build-essential curl && rm -rf /var/lib/apt/lists/*
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && export PATH="$HOME/.cargo/bin:$PATH"
ENV PATH="/root/.cargo/bin:${PATH}"
RUN pip install --no-cache-dir torch==2.2.0 torchaudio==2.2.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 50001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "50001"]
