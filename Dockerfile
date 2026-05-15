FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY API_ROUTES.md README.md ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
