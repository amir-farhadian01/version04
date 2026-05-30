/**
 * /api/admin/service-packages — platform admin: cross-workspace service packages
 *
 * GET  /?page&pageSize&q&workspaceId&serviceCatalogId&bookingMode&isActive
 * GET  /by-catalog/:catalogId
 * GET  /:id  (includes BOM lines + computed margin)
 * POST /:id/force-archive
 */
import { Router, Response } from 'express';
import { BookingMode, Prisma } from '@prisma/client';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import { computePackageMargin } from '../lib/packageMargin.js';

const router = Router();
router.use(authenticate, isAdmin);

const MAX_PAGE = 100;

function parsePage(req: AuthRequest) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(MAX_PAGE, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function parseBool(v: unknown): boolean | undefined {
  if (v === 'true') return true;
  if (v === 'false') return false;
  return undefined;
}

function parseBookingModes(v: unknown): BookingMode[] | undefined {
  if (v == null) return undefined;
  const raw: string[] = [];
  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === 'string') raw.push(x);
    }
  } else if (typeof v === 'string' && v.trim()) {
    raw.push(
      ...v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  if (!raw.length) return undefined;
  const out: BookingMode[] = [];
  for (const s of raw) {
    if ((Object.values(BookingMode) as string[]).includes(s)) {
      out.push(s as BookingMode);
    }
  }
  return out.length ? out : undefined;
}

router.get('/by-catalog/:catalogId', async (req: AuthRequest, res: Response) => {
  try {
    const items = await prisma.providerServicePackage.findMany({
      where: { serviceCatalogId: req.params.catalogId },
      orderBy: [{ workspaceId: 'asc' }, { sortOrder: 'asc' }],
      include: {
        workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
        provider: { select: { id: true, displayName: true, email: true, role: true } },
        serviceCatalog: { select: { id: true, name: true, category: true, lockedBookingMode: true } },
      },
    });
    res.json(items);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { skip, pageSize, page } = parsePage(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined;
    const serviceCatalogId =
      typeof req.query.serviceCatalogId === 'string' ? req.query.serviceCatalogId : undefined;
    const bookingModes = parseBookingModes(
      (req.query as Record<string, unknown>)['bookingMode'] ?? req.query.bookingModes,
    );
    const isActiveQ = parseBool(req.query.isActive);
    const where: Prisma.ProviderServicePackageWhereInput = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { id: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }
    if (serviceCatalogId) {
      where.serviceCatalogId = serviceCatalogId;
    }
    if (bookingModes?.length) {
      where.bookingMode = { in: bookingModes };
    }
    if (isActiveQ !== undefined) {
      where.isActive = isActiveQ;
    }

    const [total, items] = await prisma.$transaction([
      prisma.providerServicePackage.count({ where }),
      prisma.providerServicePackage.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ updatedAt: 'desc' }],
        include: {
          workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
          provider: { select: { id: true, displayName: true, email: true, role: true } },
          serviceCatalog: { select: { id: true, name: true, category: true, lockedBookingMode: true, archivedAt: true } },
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
    const row = await prisma.providerServicePackage.findUnique({
      where: { id: req.params.id },
      include: {
        workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true, address: true, phone: true } },
        provider: { select: { id: true, displayName: true, email: true, role: true, status: true } },
        serviceCatalog: true,
        bom: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
            product: { select: { id: true, name: true, sku: true, archivedAt: true, unitPrice: true, currency: true } },
          },
        },
      },
    });
    if (!row) {
      return res.status(404).json({ error: 'Not found' });
    }
    const margin = computePackageMargin(row, row.bom);
    const { bom: bomLines, ...rest } = row;
    res.json({ ...rest, bom: bomLines, margin });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

router.post(
  '/:id/force-archive',
  requireRole('owner', 'platform_admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const row = await prisma.providerServicePackage.findUnique({ where: { id: req.params.id } });
      if (!row) {
        return res.status(404).json({ error: 'Not found' });
      }
      const updated = await prisma.providerServicePackage.update({
        where: { id: row.id },
        data: { archivedAt: new Date(), isActive: false },
        include: {
          workspace: { select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true } },
          provider: { select: { id: true, displayName: true, email: true, role: true } },
          serviceCatalog: { select: { id: true, name: true, category: true, lockedBookingMode: true } },
        },
      });
      res.json(updated);
    } catch (err: unknown) {
      console.error(err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  },
);

export default router;
