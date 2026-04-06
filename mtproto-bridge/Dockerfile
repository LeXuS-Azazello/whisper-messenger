# Simple Dockerfile - model downloaded at runtime
FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg wget bzip2 && rm -rf /var/lib/apt/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]