import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { categoryBreadcrumbs } from '../lib/categoryBreadcrumbs.js';
import { authenticate, requireRole, AuthRequest } from '../lib/auth.middleware.js';
import { getTreeWithServices } from '../lib/categoryServiceTreeView.js';

const router = Router();

const MAX_TREE_DEPTH = 5;

type CatRow = { id: string; name: string; parentId: string | null; description: string | null; icon: string | null };

type TreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
  icon: string | null;
  children: TreeNode[];
};

function buildCategoryTreeRows(all: CatRow[], parentId: string | null, level: number): TreeNode[] {
  if (level > MAX_TREE_DEPTH) return [];
  return all
    .filter((c) => (parentId == null ? c.parentId == null : c.parentId === parentId))
    .map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parentId,
      description: c.description,
      icon: c.icon,
      children: buildCategoryTreeRows(all, c.id, level + 1),
    }));
}

// GET /api/categories
router.get('/', async (req: AuthRequest, res: Response) => {
  const { parentId } = req.query as { parentId?: string };
  try {
    const where: { parentId?: string | null } = {};
    if (parentId === 'null' || parentId === '') where.parentId = null;
    else if (parentId) where.parentId = parentId;

    const categories = await prisma.category.findMany({
      where,
      include: { children: true },
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

const ADMIN_ROLES = new Set(['owner', 'platform_admin', 'support', 'finance']);

// GET /api/categories/tree-with-services — one round-trip, categories + services, sortOrder
router.get(
  '/tree-with-services',
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const isAdmin = req.user && ADMIN_ROLES.has(req.user.role);
      const inc =
        isAdmin && (req.query.includeArchived === 'true' || req.query.includeArchived === '1');
      if (req.query.includeArchived === 'true' && !isAdmin) {
        return res.status(403).json({ error: 'includeArchived is admin-only' });
      }
      const tree = await getTreeWithServices(Boolean(inc));
      res.json(tree);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  }
);

// GET /api/categories/tree — nested tree, max 5 levels (root = level 1)
router.get('/tree', async (req: AuthRequest, res: Response) => {
  try {
    const all: CatRow[] = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    const tree = buildCategoryTreeRows(all, null, 1);
    res.json(tree);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/categories/search?q=&limit= — categories + service catalog tiles (F5 wizard)
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    if (!q) {
      return res.json({ categories: [], serviceCatalogs: [] });
    }

    const allCats: CatRow[] = await prisma.category.findMany({ orderBy: { name: 'asc' } });
    const catById = new Map(allCats.map((c) => [c.id, c] as const));

    function pathIdsFor(leafId: string): string[] {
      const ids: string[] = [];
      let id: string | null = leafId;
      const seen = new Set<string>();
      for (let i = 0; i < 6 && id && !seen.has(id); i++) {
        seen.add(id);
        const row = catById.get(id);
        if (!row) break;
        ids.unshift(row.id);
        id = row.parentId;
      }
      return ids;
    }

    const [catRows, catalogRows] = await Promise.all([
      prisma.category.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      prisma.serviceCatalog.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          categoryId: true,
          description: true,
        },
      }),
    ]);

    const categories = catRows.map((c) => {
      const crumbs = pathIdsFor(c.id)
        .map((pid) => catById.get(pid))
        .filter(Boolean)
        .map((r) => r!.name);
      return {
        id: c.id,
        name: c.name,
        parentId: c.parentId,
        breadcrumb: crumbs,
        pathIds: pathIdsFor(c.id),
      };
    });

    const serviceCatalogs = await Promise.all(
      catalogRows.map(async (sc) => {
        const breadcrumb = sc.categoryId
          ? (await categoryBreadcrumbs(sc.categoryId, 5)).map((x) => x.name)
          : [];
        return {
          id: sc.id,
          name: sc.name,
          slug: sc.slug,
          categoryId: sc.categoryId,
          description: sc.description,
          breadcrumb,
        };
      }),
    );

    res.json({ categories, serviceCatalogs });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// POST /api/categories (admin only)
router.post('/', authenticate, requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  const { name, parentId, description, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });

  try {
    const category = await prisma.category.create({
      data: { name, parentId: parentId || null, description, icon },
    });
    res.status(201).json(category);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// PUT /api/categories/:id (admin only)
router.put('/:id', authenticate, requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const updated = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(updated);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// DELETE /api/categories/:id (admin only)
router.delete('/:id', authenticate, requireRole('owner', 'platform_admin'), async (req: AuthRequest, res: Response) => {
  try {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
