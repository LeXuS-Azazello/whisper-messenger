FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# We will run index.js
CMD ["node", "src/index.js"]
