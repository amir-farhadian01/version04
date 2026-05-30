import { Router, Request, Response } from 'express';
import prisma from '../lib/db.js';

const router = Router();

// GET /api/utility-links — public endpoint for admin-curated links
router.get('/', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const where: Record<string, unknown> = { isActive: true, archivedAt: null };
    if (category) where.category = category;

    const links = await prisma.utilityLink.findMany({
      where,
      orderBy: { title: 'asc' },
    });

    res.json({ data: links });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch utility links' });
  }
});

// POST /api/utility-links/:id/click — track click
router.post('/:id/click', async (req: Request, res: Response) => {
  try {
    const link = await prisma.utilityLink.findUnique({
      where: { id: req.params.id },
    });
    if (!link) {
      return res.status(404).json({ error: 'Utility link not found' });
    }

    await prisma.utilityLink.update({
      where: { id: req.params.id },
      data: { clickCount: { increment: 1 } },
    });

    await prisma.utilityLinkClick.create({
      data: {
        linkId: req.params.id,
        userId: (req as any).user?.id ?? null,
        ipHash: null,
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

export default router;
