FROM node:24-bookworm-slim

WORKDIR /app

# Нужно для сборки sherpa-onnx-node
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    cmake \
    git \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL for CPU-only sherpa-onnx inference (prevents thread explosion inside ONNX Runtime / OpenMP)
# Must be set before any native module that uses OpenMP / libgomp / onnxruntime is loaded.
ENV OMP_NUM_THREADS=1
ENV OMP_WAIT_POLICY=PASSIVE
# Also tame common BLAS backends that sherpa-onnx may pull in
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV GOTO_NUM_THREADS=1

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 8000
CMD ["node", "src/app.js"]
