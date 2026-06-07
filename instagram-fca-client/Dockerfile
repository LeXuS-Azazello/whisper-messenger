FROM node:24-alpine
WORKDIR /app
COPY instagram-fca-client/package*.json ./
RUN npm install
COPY instagram-fca-client/ ./
COPY shared/ ./shared/
CMD ["node", "src/index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
