# --- Build Stage ---
FROM node:20-bookworm AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-bookworm-slim

# Install Chromium and Puppeteer dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    libxshmfence1 \
    libx11-xcb1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled files and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/ui ./src/ui
COPY --from=builder /app/favicon.svg ./

EXPOSE 3000

# Run the compiled JS directly
CMD ["node", "dist/server.js"]
