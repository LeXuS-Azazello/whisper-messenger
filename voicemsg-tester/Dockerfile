FROM node:20-bookworm-slim

WORKDIR /app

# Copy dependency definition
COPY package*.json tsconfig.json ./

# Install all dependencies (including devDependencies so vitest is available)
RUN npm install

# Copy source code
COPY src/ ./src/

EXPOSE 3000

# Start server using tsx
CMD ["npm", "start"]
