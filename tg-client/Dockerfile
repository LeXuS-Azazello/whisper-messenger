FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ gcc && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY . .
ENV TDLIB_PATH=/app/tdlib/lib/libtdjson.so
EXPOSE 3001
CMD ["node", "src/index.js"]