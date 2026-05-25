# --- Build Stage ---
FROM node:24-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    cmake \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# --- Production Stage ---
FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

ENV OMP_NUM_THREADS=1
ENV OMP_WAIT_POLICY=PASSIVE
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV GOTO_NUM_THREADS=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/src ./src

EXPOSE 8000
CMD ["node", "src/app.js"]
