function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (value !== undefined && value !== '') return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`缺少必要的环境变量: ${name}`);
}

function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name];
  if (value !== undefined && value !== '') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`缺少必要的环境变量: ${name}`);
}

export const config = {
  jwt: {
    secret: getEnv('JWT_SECRET', 'your-secret-key'),
    accessTokenExpires: '15m',
    refreshTokenExpiresDays: 7
  },
  server: {
    port: getEnvNumber('PORT', 8000),
    cookieSecure: getEnv('COOKIE_SECURE', 'false') === 'true'
  }
} as const;

export type Config = typeof config;
