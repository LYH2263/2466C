import { Request, Response, NextFunction } from 'express';
import { IncomingMessage, ServerResponse } from 'http';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'crypto';
import logger from '../logger.js';
import { config } from '../config.js';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
    log: typeof logger;
  }
}

const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => {
    const existingId = req.headers['x-request-id'] as string | undefined;
    return existingId || randomUUID();
  },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    }
    if (res.statusCode >= 500 || err) {
      return 'error';
    }
    if (res.statusCode >= 300) {
      return 'debug';
    }
    return 'info';
  },
  customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
    const expressReq = req as IncomingMessage & { originalUrl?: string };
    return `${req.method} ${expressReq.originalUrl || req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req: IncomingMessage, res: ServerResponse, _err?: Error) => {
    const expressReq = req as IncomingMessage & { originalUrl?: string };
    return `${req.method} ${expressReq.originalUrl || req.url} ${res.statusCode}`;
  },
  autoLogging: {
    ignore: (req: IncomingMessage) => {
      const expressReq = req as IncomingMessage & { originalUrl?: string };
      const url = expressReq.originalUrl || req.url || '';
      return url === '/health' || url === '/favicon.ico';
    },
  },
  transport: config.isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname,reqId',
          singleLine: true,
        },
      }
    : undefined,
});

function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.id) {
    const existingId = req.headers['x-request-id'] as string | undefined;
    req.id = existingId || randomUUID();
  }

  res.setHeader('X-Request-ID', req.id);

  next();
}

export function createLoggerMiddleware() {
  return [requestIdMiddleware, httpLogger];
}

export default createLoggerMiddleware;
