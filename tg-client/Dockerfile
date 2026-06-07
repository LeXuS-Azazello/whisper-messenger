FROM node:20-bookworm-slim
WORKDIR /app

COPY tg-client/package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY tg-client/ ./
COPY shared/ ./shared/
ENV TDLIB_PATH=/app/tdlib/lib/libtdjson.so
EXPOSE 3001
CMD ["node", "src/index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
