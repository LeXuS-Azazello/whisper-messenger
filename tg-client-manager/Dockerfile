FROM node:22-bullseye-slim AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
