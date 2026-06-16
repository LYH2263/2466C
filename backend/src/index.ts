import { Server } from 'http';
import { createApp, autoSeed, setShuttingDown } from './app.js';
import { getPrisma, resetPrisma } from './prisma.js';
import { config } from './config.js';
import logger from './logger.js';

let server: Server | null = null;
let isShuttingDown = false;

function setupGracefulShutdown() {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'Duplicate shutdown signal received, force exiting');
      process.exit(1);
    }

    isShuttingDown = true;
    setShuttingDown(true);
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

      const prisma = getPrisma();
      logger.info('Disconnecting from database...');
      await prisma.$disconnect();
      resetPrisma();
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

    const prisma = getPrisma();
    logger.info('Connecting to database...');
    await prisma.$queryRawUnsafe('SELECT 1');
    logger.info('Database connection established');

    await autoSeed();

    const app = createApp();
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
