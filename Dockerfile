# --- Build Stage ---
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
# Also copy bridge and tg-client package files to install their deps if needed
COPY mtproto-bridge/package*.json ./mtproto-bridge/
COPY tg-client/package*.json ./tg-client/

RUN npm install --omit=dev
RUN cd mtproto-bridge && npm install --omit=dev
RUN cd tg-client && npm install --omit=dev

# Copy compiled files and assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/ui ./src/ui
COPY --from=builder /app/favicon.svg ./

EXPOSE 3000

# Run the compiled JS directly
CMD ["node", "dist/server.js"]