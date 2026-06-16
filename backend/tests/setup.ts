import { beforeAll, afterAll, beforeEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { PrismaClient as TestPrismaClient } from './generated/client';
import { setPrisma, resetPrisma, getPrisma } from '../src/prisma.js';

const PROJECT_ROOT = process.cwd();
const PRISMA_DIR = path.resolve(PROJECT_ROOT, 'prisma');
const DB_RELATIVE = path.join('tests', 'test-data.db');
const DB_ABSOLUTE_PATH = path.resolve(PRISMA_DIR, DB_RELATIVE);
const DATABASE_URL = `file:${DB_ABSOLUTE_PATH}`;

let testPrisma: TestPrismaClient;

function ensureTestDatabase(): void {
  const generatedClientDir = path.resolve(PROJECT_ROOT, 'tests', 'generated', 'client');
  const generatedIndex = path.join(generatedClientDir, 'index.d.ts');

  if (!fs.existsSync(generatedIndex)) {
    console.log('[Test Setup] Generating test Prisma Client...');
    try {
      execSync(
        `npx prisma generate --schema prisma/schema.test.prisma`,
        { cwd: PROJECT_ROOT, stdio: ['ignore', 'ignore', 'ignore'] as any },
      );
    } catch (e) {
      console.warn('[Test Setup] Prisma generate warning (may be ok):', (e as Error).message);
    }
  }

  if (!fs.existsSync(DB_ABSOLUTE_PATH)) {
    console.log(`[Test Setup] Creating test database at ${DB_ABSOLUTE_PATH}...`);
    try {
      execSync(
        `npx prisma db push --schema prisma/schema.test.prisma --skip-generate`,
        { cwd: PROJECT_ROOT, stdio: ['ignore', 'ignore', 'ignore'] as any },
      );
    } catch (e) {
      console.error('[Test Setup] Failed to create test database:', (e as Error).message);
    }
  }
}

beforeAll(async () => {
  ensureTestDatabase();

  testPrisma = new TestPrismaClient({
    datasources: {
      db: {
        url: DATABASE_URL,
      },
    },
  });

  setPrisma(testPrisma as unknown as ReturnType<typeof getPrisma>);

  try {
    await testPrisma.$queryRawUnsafe('SELECT 1');
    console.log('[Test Setup] Database connection established');
  } catch (error) {
    console.error('[Test Setup] Database connection failed:', error);
    throw error;
  }
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

  if (testPrisma) {
    await testPrisma.$transaction([
      testPrisma.refreshToken.deleteMany(),
      testPrisma.assetRecord.deleteMany(),
      testPrisma.user.deleteMany(),
    ]);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  vi.useRealTimers();

  if (testPrisma) {
    try {
      await testPrisma.$transaction([
        testPrisma.refreshToken.deleteMany(),
        testPrisma.assetRecord.deleteMany(),
        testPrisma.user.deleteMany(),
      ]);
    } catch (_) {
      // ignore cleanup errors
    }

    await testPrisma.$disconnect();
    resetPrisma();
    console.log('[Test Setup] Database cleaned up and disconnected');
  }
});

export { testPrisma, DATABASE_URL };
