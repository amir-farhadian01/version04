import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, isAdmin, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import {
  MAX_CATEGORY_DEPTH,
  computeDepth,
  detectCycle,
  willExceedDepth,
} from '../lib/categoryTreeOps.js';
import { getSubtreeByCategoryId } from '../lib/categoryServiceTreeView.js';

const router = Router();
const ownerOrPlatform = requireRole('owner', 'platform_admin');

router.use(authenticate, isAdmin);

function clampIndex(i: number, len: number): number {
  if (i < 0) return 0;
  if (i > len) return len;
  return i;
}

function makeBaseSlug(s: string): string {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return t || 'service';
}

async function uniqueServiceSlug(base: string): Promise<string> {
  let c = 0;
  for (;;) {
    const slug = c === 0 ? base : `${base}-${c}`;
    const e = await prisma.serviceCatalog.findFirst({ where: { slug } });
    if (!e) return slug;
    c += 1;
    if (c > 100) return `${base}-${Date.now()}`;
  }
}

async function audit(req: AuthRequest, action: string, resourceType: string, resourceId: string, metadata?: object) {
  await prisma.auditLog.create({
    data: {
      actorId: req.user?.userId ?? null,
      action,
      resourceType,
      resourceId,
      metadata: metadata != null ? JSON.parse(JSON.stringify(metadata)) : undefined,
    },
  });
}

// POST /reorder-category
router.post('/reorder-category', async (req: AuthRequest, res: Response) => {
  const { id, newParentId, newSortOrder } = req.body as {
    id?: string;
    newParentId?: string | null;
    newSortOrder?: number;
  };
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing id' });
  }
  if (newSortOrder == null || !Number.isFinite(newSortOrder)) {
    return res.status(400).json({ error: 'Missing newSortOrder' });
  }
  const parent: string | null = newParentId == null || newParentId === '' ? null : String(newParentId);
  const idx = Math.trunc(newSortOrder);

  try {
    const node = await prisma.category.findUnique({ where: { id } });
    if (!node) return res.status(404).json({ error: 'Category not found' });
    if (parent) {
      const p = await prisma.category.findUnique({ where: { id: parent } });
      if (!p) return res.status(400).json({ error: 'New parent not found' });
    }
    if (await detectCycle(id, parent)) {
      return res.status(400).json({ error: 'Reparenting would create a cycle' });
    }
    if (await willExceedDepth(id, parent)) {
      return res.status(400).json({ error: 'Max tree depth (5 levels) would be exceeded' });
    }
    const oldParentId = node.parentId;

    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id }, data: { parentId: parent } });
      const allAtNew = await tx.category.findMany({
        where: { parentId: parent },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true },
      });
      const rest = allAtNew.map((x) => x.id).filter((x) => x !== id);
      const at = clampIndex(idx, rest.length);
      const ordered: string[] = [];
      for (let i = 0; i < at; i += 1) {
        if (i < rest.length) ordered.push(rest[i]!);
      }
      ordered.push(id);
      for (let i = at; i < rest.length; i += 1) {
        ordered.push(rest[i]!);
      }
      for (let i = 0; i < ordered.length; i += 1) {
        await tx.category.update({ where: { id: ordered[i]! }, data: { sortOrder: i } });
      }
      if (oldParentId && oldParentId !== parent) {
        const sibOld = await tx.category.findMany({
          where: { parentId: oldParentId },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true },
        });
        for (let i = 0; i < sibOld.length; i += 1) {
          await tx.category.update({ where: { id: sibOld[i]!.id }, data: { sortOrder: i } });
        }
      }
    });

    await audit(req, 'CATEGORY_REORDER', 'category', id, { newParentId: parent, newSortOrder: idx });
    const subtreeRoot = parent == null ? id : parent;
    const subtree = await getSubtreeByCategoryId(subtreeRoot, true);
    res.json({ subtree, newParentId: parent });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /reorder-service
router.post('/reorder-service', async (req: AuthRequest, res: Response) => {
  const { id, newCategoryId, newSortOrder } = req.body as {
    id?: string;
    newCategoryId?: string;
    newSortOrder?: number;
  };
  if (!id || typeof id !== 'string' || !newCategoryId) {
    return res.status(400).json({ error: 'Missing id or newCategoryId' });
  }
  if (newSortOrder == null || !Number.isFinite(newSortOrder)) {
    return res.status(400).json({ error: 'Missing newSortOrder' });
  }
  const idx = Math.trunc(newSortOrder);
  try {
    const s = await prisma.serviceCatalog.findUnique({ where: { id } });
    if (!s) return res.status(404).json({ error: 'Service not found' });
    const cat = await prisma.category.findUnique({ where: { id: newCategoryId } });
    if (!cat) return res.status(400).json({ error: 'Category not found' });
    const oldCat = s.categoryId;

    await prisma.$transaction(async (tx) => {
      await tx.serviceCatalog.update({
        where: { id },
        data: { categoryId: newCategoryId, category: cat.name },
      });
      const sib = await tx.serviceCatalog.findMany({
        where: { categoryId: newCategoryId, id: { not: id } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true },
      });
      const ordered = sib.map((x) => x.id);
      const at = clampIndex(idx, ordered.length);
      ordered.splice(at, 0, id);
      for (let i = 0; i < ordered.length; i += 1) {
        await tx.serviceCatalog.update({ where: { id: ordered[i]! }, data: { sortOrder: i } });
      }
      if (oldCat && oldCat !== newCategoryId) {
        const sibOld = await tx.serviceCatalog.findMany({
          where: { categoryId: oldCat },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { id: true },
        });
        for (let i = 0; i < sibOld.length; i += 1) {
          await tx.serviceCatalog.update({ where: { id: sibOld[i]!.id }, data: { sortOrder: i } });
        }
      }
    });
    await audit(req, 'SERVICE_REORDER', 'serviceCatalog', id, { newCategoryId, newSortOrder: idx });
    res.json({ ok: true, newCategoryId });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /archive-category
router.post(
  '/archive-category',
  ownerOrPlatform,
  async (req: AuthRequest, res: Response) => {
    const { id, cascade } = req.body as { id?: string; cascade?: boolean };
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const root = await prisma.category.findUnique({ where: { id } });
      if (!root) return res.status(404).json({ error: 'Not found' });
      const toArchive: string[] = [id];
      if (cascade) {
        const q: string[] = [id];
        while (q.length) {
          const p = q.shift()!;
          const ch = await prisma.category.findMany({ where: { parentId: p }, select: { id: true } });
          for (const c of ch) {
            toArchive.push(c.id);
            q.push(c.id);
          }
        }
      }
      const t = new Date();
      await prisma.category.updateMany({
        where: { id: { in: toArchive } },
        data: { archivedAt: t },
      });
      const fresh = await prisma.category.findUnique({ where: { id } });
      await audit(req, 'CATEGORY_ARCHIVE', 'category', id, { cascade: Boolean(cascade) });
      res.json({ id, archivedAt: fresh?.archivedAt?.toISOString() ?? null, count: toArchive.length });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  }
);

// POST /unarchive-category
router.post(
  '/unarchive-category',
  ownerOrPlatform,
  async (req: AuthRequest, res: Response) => {
    const { id, cascade } = req.body as { id?: string; cascade?: boolean };
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const toFix: string[] = [id];
      if (cascade) {
        const q: string[] = [id];
        while (q.length) {
          const p = q.shift()!;
          const ch = await prisma.category.findMany({ where: { parentId: p }, select: { id: true } });
          for (const c of ch) {
            toFix.push(c.id);
            q.push(c.id);
          }
        }
      }
      await prisma.category.updateMany({
        where: { id: { in: toFix } },
        data: { archivedAt: null },
      });
      const fresh = await prisma.category.findUnique({ where: { id } });
      await audit(req, 'CATEGORY_UNARCHIVE', 'category', id, { cascade: Boolean(cascade) });
      res.json({ id, archivedAt: fresh?.archivedAt ?? null });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  }
);

async function setServiceArchived(id: string, on: boolean) {
  const t = on ? new Date() : null;
  await prisma.serviceCatalog.update({ where: { id }, data: { archivedAt: t } });
}

// POST /archive-service
router.post(
  '/archive-service',
  ownerOrPlatform,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.body as { id?: string };
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      const before = await prisma.serviceCatalog.findUnique({ where: { id } });
      if (!before) return res.status(404).json({ error: 'Not found' });
      await setServiceArchived(id, true);
      const s = await prisma.serviceCatalog.findUnique({ where: { id } });
      await audit(req, 'SERVICE_ARCHIVE', 'serviceCatalog', id, {});
      res.json({ id, archivedAt: s?.archivedAt?.toISOString() ?? new Date().toISOString() });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  }
);

// POST /unarchive-service
router.post(
  '/unarchive-service',
  ownerOrPlatform,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.body as { id?: string };
    if (!id) return res.status(400).json({ error: 'Missing id' });
    try {
      await setServiceArchived(id, false);
      await audit(req, 'SERVICE_UNARCHIVE', 'serviceCatalog', id, {});
      res.json({ id, archivedAt: null });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  }
);

// POST /create-child-category
router.post('/create-child-category', async (req: AuthRequest, res: Response) => {
  const { parentId, name, icon, description } = req.body as {
    parentId?: string | null;
    name?: string;
    icon?: string;
    description?: string;
  };
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Missing name' });
  }
  const p = parentId == null || parentId === '' ? null : String(parentId);
  try {
    if (p) {
      const d = await computeDepth(p);
      if (d >= MAX_CATEGORY_DEPTH) {
        return res.status(400).json({ error: 'Max tree depth (5 levels) reached; cannot add child' });
      }
    }
    const sibs = await prisma.category.findMany({ where: { parentId: p } });
    const maxO = sibs.length ? Math.max(...sibs.map((x) => x.sortOrder)) : -1;
    const order = maxO + 1;
    const created = await prisma.category.create({
      data: {
        name: name.trim(),
        parentId: p,
        icon: icon == null || icon === '' ? null : String(icon),
        description: description == null ? null : String(description),
        sortOrder: order,
      },
    });
    await audit(req, 'CATEGORY_CREATE_CHILD', 'category', created.id, { parentId: p });
    res.status(201).json(created);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /create-leaf-service
router.post('/create-leaf-service', async (req: AuthRequest, res: Response) => {
  const { categoryId, name, slug: slugIn } = req.body as { categoryId?: string; name?: string; slug?: string };
  if (!categoryId || !name) {
    return res.status(400).json({ error: 'categoryId and name required' });
  }
  try {
    const cat = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!cat) return res.status(400).json({ error: 'Category not found' });
    const base = slugIn && String(slugIn).trim() ? makeBaseSlug(String(slugIn)) : makeBaseSlug(name);
    const slug = await uniqueServiceSlug(base);
    const sibs = await prisma.serviceCatalog.findMany({ where: { categoryId } });
    const order = sibs.length ? Math.max(...sibs.map((x) => x.sortOrder)) + 1 : 0;
    const created = await prisma.serviceCatalog.create({
      data: {
        name: name.trim(),
        category: cat.name,
        categoryId: cat.id,
        slug,
        dynamicFieldsSchema: null,
        isActive: true,
        sortOrder: order,
        complianceTags: [],
      },
    });
    await audit(req, 'SERVICE_CATALOG_CREATE', 'serviceCatalog', created.id, { categoryId });
    res.status(201).json(created);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
