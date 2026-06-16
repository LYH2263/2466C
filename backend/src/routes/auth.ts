import { Router, Request } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../index.js';
import crypto from 'crypto';
import { requireAuth, generateAccessToken } from '../middleware/auth.js';
import { config } from '../config.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError } from '../errors.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
});

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
});

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/register', asyncHandler(async (req, res) => {
  const { email, password } = registerSchema.parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ConflictError('该邮箱已被注册');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
    },
    select: {
      id: true,
      email: true,
      createdAt: true,
    },
  });

  req.log?.info({ userId: user.id, email }, 'User registered successfully');

  res.status(201).json({
    message: '注册成功',
    user,
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new UnauthorizedError('邮箱或密码错误');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / (1000 * 60));
    throw new ForbiddenError(`账号已被锁定，请在 ${minutes} 分钟后重试`);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const newCount = user.failedLoginCount + 1;

    if (newCount >= 5) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newCount,
          lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      throw new ForbiddenError('连续登录失败5次，账号已被锁定15分钟');
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: newCount },
      });
    }

    throw new UnauthorizedError('邮箱或密码错误');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: refreshTokenHash,
      expiresAt: new Date(Date.now() + config.jwt.refreshTokenExpiresDays * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.server.cookieSecure,
    sameSite: 'lax',
    maxAge: config.jwt.refreshTokenExpiresDays * 24 * 60 * 60 * 1000,
  });

  req.log?.info({ userId: user.id, email }, 'User logged in successfully');

  res.json({
    message: '登录成功',
    accessToken,
    user: {
      id: user.id,
      email: user.email,
    },
  });
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new UnauthorizedError('未提供刷新令牌');
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('刷新令牌无效或已过期');
  }

  const accessToken = generateAccessToken(storedToken.userId);

  res.json({
    accessToken,
    user: {
      id: storedToken.user.id,
      email: storedToken.user.email,
    },
  });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);

    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    res.clearCookie('refreshToken');
  }

  req.log?.info('User logged out');

  res.json({ message: '退出登录成功' });
}));

router.get('/me', requireAuth, asyncHandler(async (req: Request, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new NotFoundError('用户不存在');
  }

  res.json({ user });
}));

export default router;
