import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  createTestApp,
  registerUser,
  loginUser,
  createUserInDb,
  loginUserWithAgent,
} from './helpers.js';
import { getPrisma } from '../src/prisma.js';
import { config } from '../src/config.js';

const app = createTestApp();

describe('Auth Module - 注册接口', () => {
  it('POST /api/auth/register - 注册成功返回 201 和用户信息', async () => {
    const email = 'newuser@example.com';
    const response = await registerUser(app, email, 'password123');

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('注册成功');
    expect(response.body.user).toBeDefined();
    expect(response.body.user.email).toBe(email);
    expect(response.body.user.id).toBeDefined();
    expect(response.body.user.createdAt).toBeDefined();
    expect(response.body.user.passwordHash).toBeUndefined();

    const prisma = getPrisma();
    const savedUser = await prisma.user.findUnique({ where: { email } });
    expect(savedUser).not.toBeNull();
    expect(savedUser?.email).toBe(email);
    expect(savedUser?.passwordHash).toBeDefined();
    expect(savedUser?.failedLoginCount).toBe(0);
    expect(savedUser?.lockedUntil).toBeNull();
  });

  it('POST /api/auth/register - 邮箱重复返回 409 Conflict', async () => {
    const email = 'duplicate@example.com';
    await registerUser(app, email, 'password123');

    const response = await registerUser(app, email, 'anotherpass');

    expect(response.statusCode).toBe(409);
    expect(response.body.code).toBe('CONFLICT');
    expect(response.body.message).toBe('该邮箱已被注册');
  });

  it('POST /api/auth/register - 密码太短返回 400 校验错误', async () => {
    const response = await registerUser(app, 'short@example.com', '123');

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/auth/register - 邮箱格式错误返回 400 校验错误', async () => {
    const response = await registerUser(app, 'not-an-email', 'password123');

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('Auth Module - 登录接口', () => {
  it('POST /api/auth/login - 登录成功签发 accessToken 和 refresh cookie', async () => {
    const email = 'loginok@example.com';
    const password = 'password123';
    await createUserInDb(email, password);

    const response = await loginUser(app, email, password);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('登录成功');
    expect(response.body.accessToken).toBeDefined();
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).toEqual({
      id: expect.any(String),
      email,
    });

    const decoded = jwt.verify(response.body.accessToken, config.jwt.secret) as { userId: string };
    expect(decoded.userId).toBe(response.body.user.id);

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies?.find((c: string) => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Max-Age=');

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.failedLoginCount).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });

  it('POST /api/auth/login - 邮箱不存在返回 401', async () => {
    const response = await loginUser(app, 'nonexistent@example.com', 'password123');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toBe('邮箱或密码错误');
  });

  it('POST /api/auth/login - 密码错误返回 401 并累计失败次数', async () => {
    const email = 'failonce@example.com';
    const password = 'correctpassword';
    await createUserInDb(email, password);

    const response = await loginUser(app, email, 'wrongpassword');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toBe('邮箱或密码错误');

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.failedLoginCount).toBe(1);
    expect(user?.lockedUntil).toBeNull();
  });

  it('POST /api/auth/login - 第 5 次密码错误触发锁定返回 403', async () => {
    const email = 'lockuser@example.com';
    const password = 'correctpassword';
    await createUserInDb(email, password, { failedLoginCount: 4 });

    const response = await loginUser(app, email, 'wrongpassword');

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(response.body.message).toBe('连续登录失败5次，账号已被锁定15分钟');

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.failedLoginCount).toBe(5);
    expect(user?.lockedUntil).not.toBeNull();
    const lockedUntil = user?.lockedUntil as Date;
    const expectedUnlock = new Date(Date.now() + 15 * 60 * 1000);
    expect(Math.abs(lockedUntil.getTime() - expectedUnlock.getTime())).toBeLessThan(2000);
  });

  it('POST /api/auth/login - 锁定期内登录拒绝返回 403', async () => {
    const email = 'lockedin@example.com';
    const password = 'correctpassword';
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
    await createUserInDb(email, password, { lockedUntil, failedLoginCount: 5 });

    const response = await loginUser(app, email, password);

    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(response.body.message).toContain('账号已被锁定');
    expect(response.body.message).toMatch(/\d+ 分钟后重试/);
  });

  it('POST /api/auth/login - 锁定到期后恢复正常登录', async () => {
    const email = 'expiredlock@example.com';
    const password = 'correctpassword';
    const pastLockedUntil = new Date(Date.now() - 60 * 1000);
    await createUserInDb(email, password, { lockedUntil: pastLockedUntil, failedLoginCount: 5 });

    const response = await loginUser(app, email, password);

    expect(response.statusCode).toBe(200);
    expect(response.body.accessToken).toBeDefined();

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.failedLoginCount).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });

  it('POST /api/auth/login - 登录成功后清零失败计数', async () => {
    const email = 'clearcount@example.com';
    const password = 'correctpassword';
    await createUserInDb(email, password, { failedLoginCount: 3 });

    const response = await loginUser(app, email, password);

    expect(response.statusCode).toBe(200);

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.failedLoginCount).toBe(0);
    expect(user?.lockedUntil).toBeNull();
  });
});

describe('Auth Module - /me 接口', () => {
  it('GET /api/auth/me - 携带有效 token 返回用户信息', async () => {
    const email = 'me@example.com';
    const auth = await loginUserWithAgent(app, email);

    const response = await auth.agent
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${auth.accessToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.id).toBe(auth.userId);
    expect(response.body.user.email).toBe(auth.email);
    expect(response.body.user.role).toBe('user');
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('GET /api/auth/me - 无 token 返回 401', async () => {
    const { agent } = await loginUserWithAgent(app, 'menotoken@example.com');

    const response = await agent.get('/api/auth/me');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/auth/me - 过期 token 返回 401', async () => {
    const email = 'meexpired@example.com';
    const user = await createUserInDb(email);
    const exp = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = jwt.sign({ userId: user.id, exp }, config.jwt.secret);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('无效或已过期');
  });
});
