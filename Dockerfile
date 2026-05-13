FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
# Use npm install to ensure dependencies from package.json are correctly handled
RUN npm install --omit=dev

# Verify critical packages are present
RUN ls -d node_modules/@hono/node-server && ls -d node_modules/tsx

# Copy source code
COPY src/ ./src/
COPY favicon.svg ./

# Expose port
EXPOSE 3000

# Use the local tsx binary directly to avoid npx overhead and isolation issues
CMD ["./node_modules/.bin/tsx", "src/server.ts"]