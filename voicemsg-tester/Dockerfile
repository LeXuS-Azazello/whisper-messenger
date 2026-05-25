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

EXPOSE 3000

# Start server using tsx
CMD ["npm", "start"]
