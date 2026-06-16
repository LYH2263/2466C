import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().int().positive().default(8000),
  DATABASE_URL: z.string().url('DATABASE_URL 必须是有效的 PostgreSQL 连接字符串'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少需要 32 个字符').superRefine((val, ctx) => {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && val === 'your-secret-key') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '生产环境必须设置安全的 JWT_SECRET，不能使用默认值',
      });
    }
  }),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

type RawEnv = z.input<typeof envSchema>;
type Env = z.infer<typeof envSchema>;

function validateEnv(raw: RawEnv): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `[${path}] ${issue.message}`;
    });
    console.error('环境变量校验失败:\n' + issues.join('\n'));
    process.exit(1);
  }

  return result.data;
}

const env = validateEnv(process.env as unknown as z.input<typeof envSchema>);

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  jwt: {
    secret: env.JWT_SECRET,
    accessTokenExpires: env.JWT_ACCESS_EXPIRES,
    refreshTokenExpiresDays: env.JWT_REFRESH_EXPIRES_DAYS,
  },
  server: {
    port: env.PORT,
    cookieSecure: env.COOKIE_SECURE,
  },
  database: {
    url: env.DATABASE_URL,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
} as const;

export type Config = typeof config;
