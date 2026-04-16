# Simple Dockerfile - no local models, uses external whisper-server
FROM node:20-bookworm

RUN apt-get update && apt-get install -y ffmpeg wget bzip2 && rm -rf /var/lib/apt/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN chmod +x entrypoint.sh
CMD ["./entrypoint.sh"]