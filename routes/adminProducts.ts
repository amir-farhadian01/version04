/**
 * /api/admin/products — platform admin: read-only global inventory across workspaces
 *
 * GET  /meta/workspaces — short workspace list for inventory filters (id, name, slug, logoUrl)
 * GET  /?page&pageSize&workspaceId&q&category&isActive&archived&sortBy&sortDir
 * GET  /:id — product + usedInPackages (distinct packages referencing this product in BOMs)
 */
import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, AuthRequest } from '../lib/auth.middleware.js';

const router = Router();
router.use(authenticate, isAdmin);

const MAX_PAGE = 100;

function parsePage(req: AuthRequest) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(
    MAX_PAGE,
    Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20),
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseArchivedFilter(v: unknown): 'archived' | 'active' | 'all' {
  if (v === 'true') return 'archived';
  if (v === 'false') return 'active';
  return 'all';
}

const SORT_FIELDS = new Set(['createdAt', 'name', 'sku', 'unitPrice', 'sortOrder', 'category', 'updatedAt']);

router.get('/meta/workspaces', async (_req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.company.findMany({
      take: 400,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
    res.json({ items });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { skip, pageSize, page } = parsePage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const workspaceId =
      typeof req.query.workspaceId === 'string' && req.query.workspaceId ? req.query.workspaceId : undefined;
    const category =
      typeof req.query.category === 'string' && req.query.category ? req.query.category : undefined;
    const isActiveQ =
      req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const archivedMode = parseArchivedFilter(req.query.archived);
    const sortBy = typeof req.query.sortBy === 'string' && SORT_FIELDS.has(req.query.sortBy) ? req.query.sortBy : 'updatedAt';
    const sortDir = req.query.sortDir === 'asc' ? 'asc' : 'desc';

    const where: Prisma.ProductWhereInput = {};
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) {
      where.category = category;
    }
    if (isActiveQ !== undefined) {
      where.isActive = isActiveQ;
    }
    if (archivedMode === 'archived') {
      where.archivedAt = { not: null };
    } else if (archivedMode === 'active') {
      where.archivedAt = null;
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortDir };

    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
          _count: { select: { bomLines: true } },
        },
      }),
    ]);
    res.json({ items, total, page, pageSize });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const row = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true, address: true, phone: true } },
        _count: { select: { bomLines: true } },
      },
    });
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    const bomRefs = await prisma.productInPackage.findMany({
      where: { productId: row.id },
      select: {
        package: {
          select: {
            id: true,
            name: true,
            finalPrice: true,
            currency: true,
            isActive: true,
            archivedAt: true,
            workspaceId: true,
            workspace: { select: { id: true, name: true, logoUrl: true, slug: true } },
          },
        },
      },
    });
    const byPkg = new Map<string, (typeof bomRefs)[0]['package']>();
    for (const ref of bomRefs) {
      byPkg.set(ref.package.id, ref.package);
    }
    const usedInPackages = [...byPkg.values()];
    res.json({ ...row, usedInPackages });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
