import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Validation schema
const assetSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD'),
  cash: z.number().min(0, '金额不能为负数'),
  longTermInvest: z.number().min(0, '金额不能为负数'),
  stableBond: z.number().min(0, '金额不能为负数'),
  note: z.string().max(100, '备注最多100字').optional()
}).refine((data) => {
  return data.cash > 0 || data.longTermInvest > 0 || data.stableBond > 0;
}, {
  message: '至少输入一项资产金额'
});

// Auth middleware
function authMiddleware(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未提供访问令牌' });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: '访问令牌无效或已过期' });
  }
}

// Get all assets for current user
router.get('/', authMiddleware, async (req: any, res) => {
  try {
    const records = await prisma.assetRecord.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' }
    });

    res.json({ records });
  } catch (error) {
    console.error('Get assets error:', error);
    res.status(500).json({ error: '获取资产记录失败' });
  }
});

// Create new asset record
router.post('/', authMiddleware, async (req: any, res) => {
  try {
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
        note: data.note
      }
    });

    res.status(201).json({ 
      message: '添加成功',
      record 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Create asset error:', error);
    res.status(500).json({ error: '添加资产记录失败' });
  }
});

// Delete asset record
router.delete('/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Check if record exists and belongs to user
    const record = await prisma.assetRecord.findFirst({
      where: {
        id,
        userId: req.userId
      }
    });

    if (!record) {
      return res.status(404).json({ error: '记录不存在或无权限删除' });
    }

    await prisma.assetRecord.delete({
      where: { id }
    });

    res.json({ message: '删除成功' });
  } catch (error) {
    console.error('Delete asset error:', error);
    res.status(500).json({ error: '删除资产记录失败' });
  }
});

export default router;
