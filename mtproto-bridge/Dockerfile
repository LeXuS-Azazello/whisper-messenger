FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build 2>/dev/null || true

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache ffmpeg python3 py3-pip
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/index.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/*.js ./
EXPOSE 3000
CMD ["node", "index.js"]