# --- Build Stage ---
FROM node:20-bookworm AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-bookworm-slim

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