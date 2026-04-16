# Simple Dockerfile - model downloaded at build time
FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg wget bzip2 && rm -rf /var/lib/apt/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Preload the sherpa model during build
RUN node preload-model.cjs

RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]