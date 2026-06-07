FROM node:20-alpine
WORKDIR /app
COPY facebook-fca-client/package*.json ./
RUN npm install
COPY facebook-fca-client/ ./
COPY shared/ ./shared/
CMD ["node", "src/index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
