import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {
  createTestApp,
  createUserInDb,
  createRefreshTokenInDb,
  loginUserWithAgent,
} from './helpers.js';
import { config } from '../src/config.js';

const app = createTestApp();

describe('Auth Module - Refresh Token', () => {
  it('POST /api/auth/refresh - 有效 refresh token 返回新 accessToken', async () => {
    const email = 'refreshok@example.com';
    const auth = await loginUserWithAgent(app, email);

    const response = await auth.agent
      .post('/api/auth/refresh');

    expect(response.statusCode).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user).toEqual({
      id: auth.userId,
      email: auth.email,
    });

    const decoded = jwt.verify(response.body.accessToken, config.jwt.secret) as { userId: string };
    expect(decoded.userId).toBe(auth.userId);
  });

  it('POST /api/auth/refresh - 未携带 cookie 返回 401', async () => {
    const response = await request(app)
      .post('/api/auth/refresh');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toBe('未提供刷新令牌');
  });

  it('POST /api/auth/refresh - 无效 token 返回 401', async () => {
    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', 'refreshToken=invalid-random-token-string-123456');

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('无效或已过期');
  });

  it('POST /api/auth/refresh - 已过期 refresh token 返回 401', async () => {
    const user = await createUserInDb('expiredrefresh@example.com');
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { rawToken } = await createRefreshTokenInDb(user.id, {
      expiresAt: pastDate,
    });

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${rawToken}`);

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('无效或已过期');
  });

  it('POST /api/auth/refresh - 已吊销 token 返回 401', async () => {
    const user = await createUserInDb('revokedrefresh@example.com');
    const revokedAt = new Date(Date.now() - 60 * 1000);
    const { rawToken } = await createRefreshTokenInDb(user.id, {
      revokedAt,
    });

    const response = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${rawToken}`);

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(response.body.message).toContain('无效或已过期');
  });

  it('POST /api/auth/logout - 退出登录吊销 token 并清除 cookie', async () => {
    const email = 'logout@example.com';
    const auth = await loginUserWithAgent(app, email);

    const refreshResponse = await auth.agent
      .post('/api/auth/refresh');
    expect(refreshResponse.statusCode).toBe(200);

    const logoutResponse = await auth.agent
      .post('/api/auth/logout');

    expect(logoutResponse.statusCode).toBe(200);
    expect(logoutResponse.body.message).toBe('退出登录成功');

    const cookies = logoutResponse.headers['set-cookie'] || [];
    const clearedCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toContain('Max-Age=0');

    const retryRefresh = await auth.agent
      .post('/api/auth/refresh');
    expect(retryRefresh.statusCode).toBe(401);
  });

  it('POST /api/auth/refresh - 多次 refresh token 均有效', async () => {
    const email = 'multi@example.com';
    const auth = await loginUserWithAgent(app, email);

    for (let i = 0; i < 3; i++) {
      const response = await auth.agent.post('/api/auth/refresh');
      expect(response.statusCode).toBe(200);
      expect(response.body.accessToken).toBeDefined();
    }
  });
});
