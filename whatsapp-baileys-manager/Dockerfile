FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3002
CMD ["node", "index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
