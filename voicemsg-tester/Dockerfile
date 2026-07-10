FROM node:20-bookworm-slim

WORKDIR /app

# Copy dependency definition
COPY package*.json ./

# Install all dependencies (including devDependencies so vitest is available)
RUN npm install

# Copy source code
COPY src/ ./src/
COPY shared/ ./shared/

# Real reference audio used for ASR + voice clone roundtrip test
COPY test_whisper.ogg ./test_whisper.ogg
COPY test_audio.ogg ./test_audio.ogg

EXPOSE 3000

# Start server using tsx
CMD ["npm", "start"]
LABEL org.opencontainers.image.source=https://forge.dev.takatan.cloud/lexus/voicemsg-net
