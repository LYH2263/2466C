import { defineConfig } from 'vitest/config';
import path from 'path';
import fs from 'fs';

function loadEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

const env = loadEnvFile(path.resolve(process.cwd(), '.env.test'));

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = env.DATABASE_URL || 'file:./prisma/tests/test-data.db';
process.env.JWT_SECRET = env.JWT_SECRET || 'test-jwt-secret-key-for-integration-tests-123456';
process.env.JWT_ACCESS_EXPIRES = env.JWT_ACCESS_EXPIRES || '15m';
process.env.JWT_REFRESH_EXPIRES_DAYS = env.JWT_REFRESH_EXPIRES_DAYS || '7';
process.env.COOKIE_SECURE = env.COOKIE_SECURE || 'false';
process.env.LOG_LEVEL = env.LOG_LEVEL || 'error';
process.env.PORT = env.PORT || '9999';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
