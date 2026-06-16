import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import logger from './logger.js';

let prismaInstance: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

  client.$on('error', (e) => {
    logger.error({ err: e }, 'Prisma error');
  });

  client.$on('warn', (e) => {
    logger.warn({ err: e }, 'Prisma warning');
  });

  return client;
}

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = createPrismaClient();
  }
  return prismaInstance;
}

export function setPrisma(client: PrismaClient): void {
  prismaInstance = client;
}

export function resetPrisma(): void {
  prismaInstance = null;
}

export type { PrismaClient };
export { createPrismaClient };
