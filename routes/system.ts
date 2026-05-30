import { Router, Response, Request } from 'express';
import prisma from '../lib/db.js';
import { isLocationSearchConfigured } from '../lib/googleMapsConfig.js';

const router = Router();

// GET /api/system/config — public endpoint (for theme etc.)
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'global' },
      select: { theme: true, paymentMethods: true, taxRate: true, commissionRate: true },
    });
    const locationSearchEnabled = await isLocationSearchConfigured();
    res.json({ ...(config || {}), locationSearchEnabled });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/system/pages/:slug — public CMS page
router.get('/pages/:slug', async (req: Request, res: Response) => {
  try {
    const page = await prisma.page.findUnique({
      where: { slug: req.params.slug },
    });
    if (!page || page.status !== 'published') return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
