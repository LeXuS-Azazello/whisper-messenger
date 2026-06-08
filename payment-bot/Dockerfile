FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the shared src folder (contains models, utils, etc)
COPY src ./src

# Copy the payment-bot code
COPY payment-bot ./payment-bot

# Start the payment bot
CMD ["npx", "tsx", "payment-bot/index.ts"]
