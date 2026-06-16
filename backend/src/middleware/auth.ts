import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config.js';
import { UnauthorizedError } from '../errors.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('未提供访问令牌');
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    req.log?.warn({ err: error, requestId: req.id }, 'JWT verification failed');
    throw new UnauthorizedError('访问令牌无效或已过期');
  }
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.accessTokenExpires } as SignOptions);
}

export { config };
