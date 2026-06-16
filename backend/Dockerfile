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

FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl

# Copy package files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Install production dependencies (to fix bcrypt architecture mismatch)
RUN npm ci --production && ./node_modules/.bin/prisma generate

ENV NODE_ENV=production

EXPOSE 8000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/prisma/seed.js && node dist/src/index.js"]
