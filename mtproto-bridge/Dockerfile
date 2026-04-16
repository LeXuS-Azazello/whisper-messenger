# Simple Dockerfile - model downloaded at build time
FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg wget bzip2 && rm -rf /var/lib/apt/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Download and extract the sherpa model during build
RUN mkdir -p models/paraformer && \
    cd models/paraformer && \
    wget -q https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2 && \
    tar -xjf sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2 --strip-components=1 && \
    rm sherpa-onnx-paraformer-zh-2023-09-14.tar.bz2

RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]