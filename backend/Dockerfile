FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN ./node_modules/.bin/prisma generate

COPY . .
RUN npm run build
RUN npm prune --production && npm install prisma@^5.7.0 --no-save

FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production

EXPOSE 8000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && node dist/src/index.js"]
