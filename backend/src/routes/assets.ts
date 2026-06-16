import { Router, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { NotFoundError } from '../errors.js';

const router = Router();

const assetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  cash: z.number().min(0, '金额不能为负数'),
  longTermInvest: z.number().min(0, '金额不能为负数'),
  stableBond: z.number().min(0, '金额不能为负数'),
  note: z.string().max(100, '备注最多100字').optional(),
}).refine((data) => {
  return data.cash > 0 || data.longTermInvest > 0 || data.stableBond > 0;
}, {
  message: '至少输入一项资产金额',
});

router.get('/', requireAuth, asyncHandler(async (req: Request, res) => {
  const records = await prisma.assetRecord.findMany({
    where: { userId: req.userId },
    orderBy: { date: 'desc' },
  });

  res.json({ records });
}));

router.post('/', requireAuth, asyncHandler(async (req: Request, res) => {
  const data = assetSchema.parse(req.body);

  const total = data.cash + data.longTermInvest + data.stableBond;

  const record = await prisma.assetRecord.create({
    data: {
      userId: req.userId,
      date: new Date(data.date),
      cash: data.cash,
      longTermInvest: data.longTermInvest,
      stableBond: data.stableBond,
      total,
      note: data.note,
    },
  });

  req.log?.info({ recordId: record.id, userId: req.userId }, 'Asset record created');

  res.status(201).json({
    message: '添加成功',
    record,
  });
}));

router.delete('/:id', requireAuth, asyncHandler(async (req: Request, res) => {
  const { id } = req.params;

  const record = await prisma.assetRecord.findFirst({
    where: {
      id,
      userId: req.userId,
    },
  });

  if (!record) {
    throw new NotFoundError('记录不存在或无权限删除');
  }

  await prisma.assetRecord.delete({
    where: { id },
  });

  req.log?.info({ recordId: id, userId: req.userId }, 'Asset record deleted');

  res.json({ message: '删除成功' });
}));

export default router;
