import pino, { Logger, LogEvent } from 'pino';
import { config } from './config.js';

const sensitiveKeys = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'jwt',
  'authorization',
  'cookie',
  'set-cookie',
];

const redactValue = '[REDACTED]';

function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 10 || obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    const lower = obj.toLowerCase();
    for (const key of sensitiveKeys) {
      if (lower.includes(key)) {
        return redactValue;
      }
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some((k) => lowerKey.includes(k))) {
        result[key] = redactValue;
      } else {
        result[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return result;
  }

  return obj;
}

function createRedactionSerializer() {
  return {
    req(obj: unknown) {
      const req = obj as Record<string, unknown>;
      const headers = redactSensitiveData(req.headers) as Record<string, string>;
      return {
        id: req.id,
        method: req.method,
        url: req.url,
        headers,
        remoteAddress: (req.socket as Record<string, unknown> | undefined)?.remoteAddress,
      };
    },
    res(obj: unknown) {
      const res = obj as Record<string, unknown>;
      return {
        statusCode: res.statusCode,
        headers: redactSensitiveData(res.headers),
      };
    },
    err(obj: unknown) {
      const err = obj as Error;
      return {
        type: err.constructor.name,
        message: err.message,
        stack: err.stack,
      };
    },
  };
}

const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    translateTime: 'HH:MM:ss Z',
    ignore: 'pid,hostname',
  },
};

const baseLogger: Logger = pino({
  level: config.logging.level,
  name: 'asset-stats-api',
  formatters: {
    level(label) {
      return { level: label };
    },
    log(object) {
      return redactSensitiveData(object) as Record<string, unknown>;
    },
  },
  serializers: createRedactionSerializer(),
  base: {
    environment: config.env,
    service: 'asset-stats-api',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.isDevelopment ? { transport: devTransport } : {}),
});

const logger: Logger = baseLogger;

export default logger;
export { redactSensitiveData };
export type { Logger };
