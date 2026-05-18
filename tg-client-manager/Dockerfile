FROM node:20-bookworm AS builder
WORKDIR /app
COPY package*.json ./
RUN apt-get update && apt-get install -y make g++ gcc python3 && npm install --omit=dev
COPY . .
RUN npm run build 2>/dev/null || true

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y ffmpeg python3 make g++ gcc && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=builder /app/index.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.js ./
COPY --from=builder /app/tdlib* ./tdlib/
ENV TDLIB_PATH=/app/tdlib/lib/libtdjson.so
EXPOSE 3000
CMD ["node", "index.js"]