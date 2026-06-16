import { describe, it, expect, vi } from 'vitest';
import {
  createTestApp,
  loginUserWithAgent,
  createAssetRecord,
  getAssetRecords,
  deleteAssetRecord,
  authHeader,
} from './helpers.js';
import request from 'supertest';
import { getPrisma } from '../src/prisma.js';

const app = createTestApp();

describe('Assets Module - 新增资产 Zod 校验', () => {
  async function getAuth() {
    return loginUserWithAgent(app, 'assetuser@example.com');
  }

  it('POST /api/assets - 新增资产成功返回 201，total 计算正确', async () => {
    const auth = await getAuth();
    const payload = {
      date: '2025-06-15',
      cash: 1000.5,
      longTermInvest: 5000,
      stableBond: 2500.25,
      note: '六月资产记录',
    };

    const response = await createAssetRecord(app, auth.accessToken, payload);

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('添加成功');
    expect(response.body.record).toBeDefined();
    expect(response.body.record.cash).toBe(payload.cash);
    expect(response.body.record.longTermInvest).toBe(payload.longTermInvest);
    expect(response.body.record.stableBond).toBe(payload.stableBond);
    expect(response.body.record.total).toBe(payload.cash + payload.longTermInvest + payload.stableBond);
    expect(response.body.record.note).toBe(payload.note);
    expect(response.body.record.userId).toBe(auth.userId);
    expect(response.body.record.id).toBeDefined();

    const prisma = getPrisma();
    const saved = await prisma.assetRecord.findUnique({
      where: { id: response.body.record.id },
    });
    expect(saved).not.toBeNull();
    expect(saved?.total).toBe(payload.cash + payload.longTermInvest + payload.stableBond);
  });

  it('POST /api/assets - 现金为负数返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: -100,
      longTermInvest: 5000,
      stableBond: 2500,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('金额不能为负数');
  });

  it('POST /api/assets - 长期投资为负数返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: -5000,
      stableBond: 2500,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('金额不能为负数');
  });

  it('POST /api/assets - 稳健债券为负数返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: -2500,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('金额不能为负数');
  });

  it('POST /api/assets - 三类金额全为 0 返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 0,
      longTermInvest: 0,
      stableBond: 0,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('至少输入一项资产金额');
  });

  it('POST /api/assets - 日期格式错误返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025/06/15',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: 2500,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('日期格式必须为 YYYY-MM-DD');
  });

  it('POST /api/assets - 非日期字符串返回 400 校验错误', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: 'not-a-date',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: 2500,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/assets - 备注超过 100 字返回 400 校验错误', async () => {
    const auth = await getAuth();
    const longNote = '注'.repeat(101);

    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: 2500,
      note: longNote,
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.message).toContain('最多100字');
  });

  it('POST /api/assets - 备注刚好 100 字通过', async () => {
    const auth = await getAuth();
    const exactNote = '一二三四五六七八九十'.repeat(10);

    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: 2500,
      note: exactNote,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.record.note).toBe(exactNote);
  });

  it('POST /api/assets - 不携带备注也能通过', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: 5000,
      stableBond: 2500,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.record.note).toBeNull();
  });

  it('POST /api/assets - total 精确计算（浮点数）', async () => {
    const auth = await getAuth();
    const response = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 0.1,
      longTermInvest: 0.2,
      stableBond: 10000.55,
    });

    expect(response.statusCode).toBe(201);
    expect(response.body.record.total).toBeCloseTo(10000.85, 2);
  });

  it('POST /api/assets - 无 token 返回 401', async () => {
    const response = await request(app)
      .post('/api/assets')
      .send({
        date: '2025-06-15',
        cash: 1000,
        longTermInvest: 5000,
        stableBond: 2500,
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});

describe('Assets Module - 查询与删除', () => {
  it('GET /api/assets - 返回当前用户记录列表', async () => {
    const auth = await loginUserWithAgent(app, 'listuser@example.com');

    await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-01',
      cash: 1000,
      longTermInvest: 2000,
      stableBond: 3000,
    });
    await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1500,
      longTermInvest: 2500,
      stableBond: 3500,
    });

    const response = await getAssetRecords(app, auth.accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.body.records).toBeDefined();
    expect(response.body.records).toHaveLength(2);
    expect(response.body.records[0].date).toBeDefined();
  });

  it('GET /api/assets - 新用户记录为空', async () => {
    const auth = await loginUserWithAgent(app, 'emptyuser@example.com');

    const response = await getAssetRecords(app, auth.accessToken);

    expect(response.statusCode).toBe(200);
    expect(response.body.records).toEqual([]);
  });

  it('DELETE /api/assets/:id - 删除自己的记录成功', async () => {
    const auth = await loginUserWithAgent(app, 'deleteuser@example.com');

    const createRes = await createAssetRecord(app, auth.accessToken, {
      date: '2025-06-15',
      cash: 1000,
      longTermInvest: 2000,
      stableBond: 3000,
    });
    const recordId = createRes.body.record.id;

    const deleteRes = await deleteAssetRecord(app, auth.accessToken, recordId);

    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.body.message).toBe('删除成功');

    const prisma = getPrisma();
    const deleted = await prisma.assetRecord.findUnique({ where: { id: recordId } });
    expect(deleted).toBeNull();
  });

  it('DELETE /api/assets/:id - 删除不存在的记录返回 404', async () => {
    const auth = await loginUserWithAgent(app, 'del404@example.com');
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const response = await deleteAssetRecord(app, auth.accessToken, fakeId);

    expect(response.statusCode).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
