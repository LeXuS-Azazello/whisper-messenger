FROM node:20-alpine
WORKDIR /app
COPY whatsapp-baileys-client/package*.json ./
RUN npm install
COPY whatsapp-baileys-client/ ./
COPY shared/ ./shared/
# We will run index.js
CMD ["node", "src/index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
