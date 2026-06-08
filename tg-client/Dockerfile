FROM node:20-bookworm-slim
WORKDIR /app

COPY shared/ ./shared/
COPY tg-client/ ./tg-client/

WORKDIR /app/tg-client
RUN npm install --omit=dev && npm cache clean --force

ENV TDLIB_PATH=/app/tg-client/tdlib/lib/libtdjson.so
EXPOSE 3001
CMD ["node", "src/index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
