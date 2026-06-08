FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the shared src folder (contains models, utils, etc)
COPY src ./src

# Copy the telegram-bot code
COPY telegram-bot ./telegram-bot

# Expose webhook port
EXPOSE 3001
ENV PORT=3001

# Start the telegram webhook server
CMD ["npx", "tsx", "telegram-bot/index.ts"]
