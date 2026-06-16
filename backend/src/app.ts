import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import { config } from './config.js';
import createLoggerMiddleware from './middleware/logger.js';
import errorHandler, { notFoundHandler, asyncHandler } from './middleware/errorHandler.js';
import { getPrisma } from './prisma.js';
import logger from './logger.js';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: string;
  service: string;
  environment: string;
  checks: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTimeMs?: number;
      error?: string;
    };
  };
}

let isShuttingDown = false;
const startTime = Date.now();

export function createApp(): Express {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3010',
      'http://localhost:5173',
    ],
    credentials: true,
  }));
  app.use(cookieParser());
  app.use(express.json());

  app.use(...createLoggerMiddleware());

  const loginLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { error: '请求过于频繁，请稍后再试' },
  });

  const refreshLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: { error: '请求过于频繁，请稍后再试' },
  });

  app.use('/api/auth/login', loginLimiter);
  app.use('/api/auth/refresh', refreshLimiter);

  async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTimeMs?: number; error?: string }> {
    const start = Date.now();
    try {
      await getPrisma().$queryRawUnsafe('SELECT 1');
      const responseTimeMs = Date.now() - start;
      return { status: 'healthy', responseTimeMs };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { status: 'unhealthy', error };
    }
  }

  app.get('/health', asyncHandler(async (req, res) => {
    const uptimeMs = Date.now() - startTime;
    const uptimeSeconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = uptimeSeconds % 60;
    const uptime = `${days}d ${hours}h ${minutes}m ${seconds}s`;

    const dbCheck = await checkDatabaseHealth();

    const response: HealthCheckResponse = {
      status: dbCheck.status === 'healthy' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime,
      service: 'asset-stats-api',
      environment: config.env,
      checks: {
        database: dbCheck,
      },
    };

    const statusCode = response.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(response);
  }));

  app.use((req, res, next) => {
    if (isShuttingDown) {
      res.setHeader('Connection', 'close');
      res.status(503).json({
        code: 'SERVICE_UNAVAILABLE',
        message: '服务正在关闭中，请稍后重试',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/assets', assetRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export async function autoSeed(): Promise<void> {
  const prisma = getPrisma();
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@example.com' },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash('admin123', 12);
      await prisma.user.create({
        data: {
          email: 'admin@example.com',
          passwordHash,
          role: 'admin',
        },
      });
      logger.info('Default admin user created');
    }
  } catch (error) {
    logger.error({ err: error }, 'Auto-seed error');
  }
}

export function setShuttingDown(value: boolean): void {
  isShuttingDown = value;
}
