import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  AppError,
  toErrorResponse,
  getErrorStatusCode,
  zodErrorToValidationError,
} from '../errors.js';
import { config } from '../config.js';
import logger from '../logger.js';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let processedError: Error = err;

  if (err instanceof z.ZodError) {
    processedError = zodErrorToValidationError(err);
  }

  const statusCode = getErrorStatusCode(processedError);
  const response = toErrorResponse(
    processedError,
    req.id,
    config.isDevelopment && !config.isProduction,
  );

  if (processedError instanceof AppError) {
    if (statusCode >= 500) {
      req.log?.error(
        {
          err: processedError,
          stack: processedError.stack,
          requestId: req.id,
          path: req.originalUrl,
          method: req.method,
        },
        processedError.message,
      );
    } else {
      req.log?.warn(
        {
          err: processedError,
          requestId: req.id,
          path: req.originalUrl,
          method: req.method,
        },
        processedError.message,
      );
    }
  } else {
    req.log?.error(
      {
        err: processedError,
        stack: processedError.stack,
        requestId: req.id,
        path: req.originalUrl,
        method: req.method,
      },
      'Unhandled error',
    );
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const error = new AppError('NOT_FOUND', `接口不存在: ${req.method} ${req.originalUrl}`);
  const response = toErrorResponse(error, req.id);

  req.log?.warn(
    {
      requestId: req.id,
      path: req.originalUrl,
      method: req.method,
    },
    'Route not found',
  );

  res.status(404).json(response);
}

export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>,
): (req: T, res: Response, next: NextFunction) => void {
  return (req: T, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export default errorHandler;
