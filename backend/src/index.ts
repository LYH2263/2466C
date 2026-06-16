import express from 'express';
import { Server } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import authRoutes from './routes/auth.js';
import assetRoutes from './routes/assets.js';
import { config } from './config.js';
import logger from './logger.js';
import createLoggerMiddleware from './middleware/logger.js';
import errorHandler, { notFoundHandler } from './middleware/errorHandler.js';


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

const app = express();
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

let server: Server | null = null;
let isShuttingDown = false;
const startTime = Date.now();

prisma.$on('error', (e) => {
  logger.error({ err: e }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ err: e }, 'Prisma warning');
});

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
  max: 5,
  message: { error: '请求过于频繁，请稍后再试' },
});

const refreshLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  message: { error: '请求过于频繁，请稍后再试' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/refresh', refreshLimiter);

async function checkDatabaseHealth(): Promise<{ status: 'healthy' | 'unhealthy'; responseTimeMs?: number; error?: string }> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTimeMs = Date.now() - start;
    return { status: 'healthy', responseTimeMs };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { status: 'unhealthy', error };
  }
}

app.get('/health', async (req, res) => {
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
});

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

async function autoSeed() {
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

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Duplicate shutdown signal received, force exiting');
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info({ signal }, 'Shutdown signal received, starting graceful shutdown');

    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out after 30s, force exiting');
      process.exit(1);
    }, 30000);

    try {
      if (server) {
        logger.info('Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          server?.close((err?: Error) => {
            if (err) reject(err);
            else resolve();
          });
        });
        logger.info('HTTP server closed');
      }

      logger.info('Disconnecting from database...');
      await prisma.$disconnect();
      logger.info('Database disconnected');

      clearTimeout(shutdownTimeout);
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      logger.error({ err: error }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    void shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.fatal({ err: error }, 'Unhandled promise rejection');
    void shutdown('unhandledRejection');
  });
}

async function startServer() {
  try {
    logger.info({ environment: config.env, port: config.server.port }, 'Starting server...');

    logger.info('Connecting to database...');
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established');

    await autoSeed();

    server = app.listen(config.server.port, () => {
      logger.info(
        {
          port: config.server.port,
          environment: config.env,
          pid: process.pid,
        },
        `Backend server running on port ${config.server.port}`,
      );
    });

    setupGracefulShutdown();
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    process.exit(1);
  }
}

startServer();

export { prisma };
