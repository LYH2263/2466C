import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: '未提供访问令牌' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    res.status(401).json({ error: '访问令牌无效或已过期' });
  }
}

export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn: config.jwt.accessTokenExpires });
}

export { config };
