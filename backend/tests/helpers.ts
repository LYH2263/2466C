import { Express } from 'express';
import request, { Agent } from 'supertest';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { getPrisma } from '../src/prisma.js';
import { config } from '../src/config.js';

export interface TestUser {
  id: string;
  email: string;
  password: string;
  passwordHash: string;
}

export interface AuthResult {
  accessToken: string;
  userId: string;
  email: string;
  cookie: string;
  agent: Agent;
}

export function createTestApp(): Express {
  return createApp();
}

export function createAgent(app: Express): Agent {
  return request.agent(app);
}

export async function createUserInDb(
  email: string,
  password: string = 'password123',
  overrides: Partial<{ role: string; failedLoginCount: number; lockedUntil: Date | null }> = {},
): Promise<TestUser> {
  const prisma = getPrisma();
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: overrides.role ?? 'user',
      failedLoginCount: overrides.failedLoginCount ?? 0,
      lockedUntil: overrides.lockedUntil ?? undefined,
    },
  });

  return {
    id: user.id,
    email,
    password,
    passwordHash,
  };
}

export async function registerUser(
  app: Express,
  email: string,
  password: string = 'password123',
): Promise<request.Response> {
  return request(app)
    .post('/api/auth/register')
    .send({ email, password });
}

export async function loginUser(
  app: Express,
  email: string,
  password: string = 'password123',
): Promise<request.Response> {
  return request(app)
    .post('/api/auth/login')
    .send({ email, password });
}

export async function loginUserWithAgent(
  app: Express,
  email: string,
  password: string = 'password123',
): Promise<AuthResult> {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, role: 'user' },
    });
  }

  const agent = createAgent(app);
  const response = await agent
    .post('/api/auth/login')
    .send({ email, password });

  if (response.statusCode !== 200) {
    throw new Error(`Login failed: ${response.statusCode} ${JSON.stringify(response.body)}`);
  }

  const cookies = response.headers['set-cookie'] || [];
  const refreshCookie = cookies.find((c) => c.startsWith('refreshToken=')) || '';

  return {
    accessToken: response.body.accessToken as string,
    userId: response.body.user.id as string,
    email: response.body.user.email as string,
    cookie: refreshCookie,
    agent,
  };
}

export function createAccessToken(userId: string, expiresIn: string = '15m'): string {
  return jwt.sign({ userId }, config.jwt.secret, { expiresIn } as jwt.SignOptions);
}

export function createExpiredAccessToken(userId: string): string {
  return jwt.sign(
    { userId, exp: Math.floor(Date.now() / 1000) - 3600 },
    config.jwt.secret,
  );
}

export async function createRefreshTokenInDb(
  userId: string,
  options: Partial<{ expiresAt: Date; revokedAt: Date | null; rawToken: string }> = {},
): Promise<{ rawToken: string; tokenHash: string; expiresAt: Date }> {
  const prisma = getPrisma();
  const rawToken = options.rawToken ?? crypto.randomBytes(40).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      revokedAt: options.revokedAt ?? undefined,
    },
  });

  return { rawToken, tokenHash, expiresAt };
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export async function createAssetRecord(
  app: Express,
  accessToken: string,
  data: {
    date: string;
    cash: number;
    longTermInvest: number;
    stableBond: number;
    note?: string;
  },
): Promise<request.Response> {
  return request(app)
    .post('/api/assets')
    .set(authHeader(accessToken))
    .send(data);
}

export async function deleteAssetRecord(
  app: Express,
  accessToken: string,
  id: string,
): Promise<request.Response> {
  return request(app)
    .delete(`/api/assets/${id}`)
    .set(authHeader(accessToken));
}

export async function getAssetRecords(
  app: Express,
  accessToken: string,
): Promise<request.Response> {
  return request(app)
    .get('/api/assets')
    .set(authHeader(accessToken));
}

export function advanceTimeByMs(ms: number, vi: any): void {
  vi.advanceTimersByTime(ms);
}

export function setSystemTime(date: Date, vi: any): void {
  vi.setSystemTime(date);
}
