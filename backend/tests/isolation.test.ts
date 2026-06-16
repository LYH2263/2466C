import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import {
  createTestApp,
  loginUserWithAgent,
  createAssetRecord,
  getAssetRecords,
  deleteAssetRecord,
  createAccessToken,
  createUserInDb,
} from './helpers.js';
import { getPrisma } from '../src/prisma.js';

const app = createTestApp();

describe('用户数据隔离测试', () => {
  it('A 用户不能看到 B 用户的资产记录', async () => {
    const userA = await loginUserWithAgent(app, 'userA@example.com');
    const userB = await loginUserWithAgent(app, 'userB@example.com');

    const assetA = await createAssetRecord(app, userA.accessToken, {
      date: '2025-06-01',
      cash: 1000,
      longTermInvest: 2000,
      stableBond: 3000,
      note: 'A的资产',
    });
    const assetB = await createAssetRecord(app, userB.accessToken, {
      date: '2025-06-01',
      cash: 9999,
      longTermInvest: 8888,
      stableBond: 7777,
      note: 'B的资产',
    });
    expect(assetA.statusCode).toBe(201);
    expect(assetB.statusCode).toBe(201);

    const listA = await getAssetRecords(app, userA.accessToken);
    expect(listA.statusCode).toBe(200);
    expect(listA.body.records).toHaveLength(1);
    expect(listA.body.records[0].note).toBe('A的资产');
    expect(listA.body.records[0].cash).toBe(1000);

    const listB = await getAssetRecords(app, userB.accessToken);
    expect(listB.statusCode).toBe(200);
    expect(listB.body.records).toHaveLength(1);
    expect(listB.body.records[0].note).toBe('B的资产');
    expect(listB.body.records[0].cash).toBe(9999);
  });

  it('A 用户删除 B 用户的记录返回 404 NOT_FOUND', async () => {
    const userA = await loginUserWithAgent(app, 'userA2@example.com');
    const userB = await loginUserWithAgent(app, 'userB2@example.com');

    const assetB = await createAssetRecord(app, userB.accessToken, {
      date: '2025-06-10',
      cash: 50000,
      longTermInvest: 100000,
      stableBond: 25000,
      note: 'B的专属资产',
    });
    expect(assetB.statusCode).toBe(201);
    const assetBId = assetB.body.record.id;

    const prisma = getPrisma();
    const savedAsset = await prisma.assetRecord.findUnique({
      where: { id: assetBId },
    });
    expect(savedAsset).not.toBeNull();
    expect(savedAsset?.userId).toBe(userB.userId);

    const deleteByA = await deleteAssetRecord(app, userA.accessToken, assetBId);

    expect(deleteByA.statusCode).toBe(404);
    expect(deleteByA.body.code).toBe('NOT_FOUND');
    expect(deleteByA.body.message).toContain('记录不存在或无权限删除');

    const stillExists = await prisma.assetRecord.findUnique({
      where: { id: assetBId },
    });
    expect(stillExists).not.toBeNull();
    expect(stillExists?.userId).toBe(userB.userId);
  });

  it('B 用户可以正常删除自己的记录（对照组）', async () => {
    const userB = await loginUserWithAgent(app, 'userB3@example.com');

    const assetB = await createAssetRecord(app, userB.accessToken, {
      date: '2025-06-10',
      cash: 100,
      longTermInvest: 200,
      stableBond: 300,
      note: 'B自己删除',
    });
    expect(assetB.statusCode).toBe(201);
    const assetBId = assetB.body.record.id;

    const deleteByB = await deleteAssetRecord(app, userB.accessToken, assetBId);
    expect(deleteByB.statusCode).toBe(200);
    expect(deleteByB.body.message).toBe('删除成功');

    const prisma = getPrisma();
    const deleted = await prisma.assetRecord.findUnique({
      where: { id: assetBId },
    });
    expect(deleted).toBeNull();
  });

  it('A 用户即使知道 B 的记录 ID，查询接口也只返回自己的数据', async () => {
    const userA = await loginUserWithAgent(app, 'userA4@example.com');
    const userB = await loginUserWithAgent(app, 'userB4@example.com');

    for (let i = 0; i < 3; i++) {
      await createAssetRecord(app, userB.accessToken, {
        date: `2025-06-${String(i + 1).padStart(2, '0')}`,
        cash: 1000 + i,
        longTermInvest: 2000 + i,
        stableBond: 3000 + i,
      });
    }
    for (let i = 0; i < 2; i++) {
      await createAssetRecord(app, userA.accessToken, {
        date: `2025-05-${String(i + 1).padStart(2, '0')}`,
        cash: 500 + i,
        longTermInvest: 600 + i,
        stableBond: 700 + i,
      });
    }

    const listA = await getAssetRecords(app, userA.accessToken);
    expect(listA.body.records).toHaveLength(2);

    const listB = await getAssetRecords(app, userB.accessToken);
    expect(listB.body.records).toHaveLength(3);
  });

  it('使用伪造的 user id token 无法访问他人数据（token 校验）', async () => {
    const realUser = await createUserInDb('real@example.com');
    const fakeUserId = '00000000-0000-0000-0000-000000000099';

    const fakeToken = createAccessToken(fakeUserId);

    const response = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${fakeToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.records).toEqual([]);
  });
});
