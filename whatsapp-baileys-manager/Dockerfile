FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# We also need whatsapp-baileys-client logic inside manager because manager spawns local client to auth!
# Wait, manager uses the client code. I will copy whatsapp-baileys-client as well in Dockerfile.
# But Docker context is limited to the directory. So I should tell the user to build from root.
CMD ["node", "index.js"]
