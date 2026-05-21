FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 8000

ENV NODE_ENV=production
CMD ["node", "src/app.js"]
