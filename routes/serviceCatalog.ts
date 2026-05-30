import { Request, Router, Response } from 'express';
import prisma from '../lib/db.js';
import { categoryBreadcrumbs } from '../lib/categoryBreadcrumbs.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { isServiceQuestionnaireV1 } from '../lib/serviceDefinitionTypes.js';
import { computePackageMargin } from '../lib/packageMargin.js';

const router = Router();

/** Category ids: root plus all descendants (BFS). */
async function categoryIdsInSubtree(rootId: string): Promise<string[]> {
  const all = await prisma.category.findMany({ select: { id: true, parentId: true } });
  const childrenByParent = new Map<string | null, string[]>();
  for (const row of all) {
    const p = row.parentId;
    if (!childrenByParent.has(p)) childrenByParent.set(p, []);
    childrenByParent.get(p)!.push(row.id);
  }
  const out: string[] = [];
  const q: string[] = [rootId];
  const seen = new Set<string>();
  while (q.length) {
    const id = q.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of childrenByParent.get(id) ?? []) q.push(c);
  }
  return out;
}

// GET /api/service-catalog/by-category/:categoryId — active catalog tiles (F5 wizard Step 1).
// Public read (no auth): guest order wizard. Optional ?deep=1 includes catalogs on descendant categories.
router.get('/by-category/:categoryId', async (req: Request, res: Response) => {
  try {
    const { categoryId } = req.params;
    const deep = req.query.deep === '1' || req.query.deep === 'true';
    const categoryIds = deep ? await categoryIdsInSubtree(categoryId) : [categoryId];
    const items = await prisma.serviceCatalog.findMany({
      where: { categoryId: { in: categoryIds }, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        categoryId: true,
        lockedBookingMode: true,
      },
    });
    res.json({ items });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/service-catalog/:id/schema — for F5 wizard; any authenticated user
router.get('/:id/schema', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const entry = await prisma.serviceCatalog.findUnique({
      where: { id: req.params.id },
      include: { category_: { select: { id: true, name: true, parentId: true } } },
    });
    if (!entry || !entry.isActive) {
      return res.status(404).json({ error: 'Service type not found or inactive' });
    }
    const raw = entry.dynamicFieldsSchema;
    if (raw == null) {
      return res.json({
        schema: null,
        breadcrumbs: [],
        serviceCatalog: {
          id: entry.id,
          name: entry.name,
          slug: entry.slug,
          lockedBookingMode: entry.lockedBookingMode,
        },
      });
    }
    if (!isServiceQuestionnaireV1(raw)) {
      return res.status(500).json({ error: 'Invalid questionnaire in catalog' });
    }
    const breadcrumbs = await categoryBreadcrumbs(entry.categoryId, 5);
    res.json({
      schema: raw,
      breadcrumbs,
      serviceCatalog: {
        id: entry.id,
        name: entry.name,
        slug: entry.slug,
        defaultMatchingMode: entry.defaultMatchingMode,
        description: entry.description,
        category: entry.category,
        subcategory: entry.subcategory,
        lockedBookingMode: entry.lockedBookingMode,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/service-catalog/:id/packages — active provider packages for wizard Step 3 (public; guest wizard).
router.get('/:id/packages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const catalog = await prisma.serviceCatalog.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });
    if (!catalog?.isActive) {
      return res.status(404).json({ error: 'Service type not found or inactive' });
    }
    const packages = await prisma.providerServicePackage.findMany({
      where: { serviceCatalogId: id, isActive: true, archivedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { finalPrice: 'asc' }],
      include: {
        bom: {
          orderBy: { sortOrder: 'asc' },
          select: {
            quantity: true,
            snapshotUnitPrice: true,
            snapshotCurrency: true,
            snapshotProductName: true,
          },
        },
        workspace: {
          select: { id: true },
        },
      },
    });

    // Collect unique workspace IDs to fetch staff info
    const workspaceIds = [...new Set(packages.map((pkg) => pkg.workspace.id))];
    const staffByWorkspace = new Map<string, { id: string; displayName: string | null; avatarUrl: string | null }[]>();
    if (workspaceIds.length > 0) {
      const companyUsers = await prisma.companyUser.findMany({
        where: { companyId: { in: workspaceIds }, role: { in: ['staff', 'member', 'admin', 'owner'] } },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true } },
        },
      });
      for (const cu of companyUsers) {
        const list = staffByWorkspace.get(cu.companyId) ?? [];
        list.push({
          id: cu.user.id,
          displayName: cu.user.displayName,
          avatarUrl: cu.user.avatarUrl,
        });
        staffByWorkspace.set(cu.companyId, list);
      }
    }

    const rows = packages.map((pkg) => {
      const bomLines = pkg.bom.map((b) => ({
        productName: b.snapshotProductName,
        quantity: b.quantity,
        unitPrice: b.snapshotUnitPrice,
        currency: b.snapshotCurrency,
      }));
      const marginInfo = computePackageMargin(
        { finalPrice: pkg.finalPrice, currency: pkg.currency },
        pkg.bom.map((b) => ({
          quantity: b.quantity,
          snapshotUnitPrice: b.snapshotUnitPrice,
          snapshotCurrency: b.snapshotCurrency,
        })),
      );
      return {
        id: pkg.id,
        name: pkg.name,
        price: pkg.finalPrice,
        duration: pkg.durationMinutes,
        bookingMode: pkg.bookingMode,
        photoRequired: pkg.photoRequired,
        bomLines,
        margin: marginInfo.margin,
        availableStaff: staffByWorkspace.get(pkg.workspace.id) ?? [],
      };
    });
    res.json(rows);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/service-catalog/package/:packageId — public lite read for wizard (single package).
router.get('/package/:packageId', async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;
    const pkg = await prisma.providerServicePackage.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        name: true,
        description: true,
        finalPrice: true,
        currency: true,
        durationMinutes: true,
        bookingMode: true,
        isActive: true,
        serviceCatalogId: true,
        workspaceId: true,
        serviceCatalog: { select: { id: true, name: true, isActive: true, categoryId: true, category_: { select: { id: true, name: true } } } },
        workspace: { select: { id: true, name: true } },
      },
    });
    if (!pkg || !pkg.isActive || !pkg.serviceCatalog.isActive) {
      return res.status(404).json({ error: 'Package not found or inactive' });
    }
    res.json({
      data: {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        price: pkg.finalPrice,
        currency: pkg.currency,
        durationMinutes: pkg.durationMinutes,
        bookingMode: pkg.bookingMode,
        serviceId: pkg.serviceCatalogId,
        serviceName: pkg.serviceCatalog.name,
        categoryId: pkg.serviceCatalog.categoryId,
        categoryName: pkg.serviceCatalog.category_?.name ?? null,
        businessId: pkg.workspaceId,
        businessName: pkg.workspace.name,
      },
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/service-catalog/:id — public lite read for wizard review (lowest active package price + BOM snapshot).
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const catalog = await prisma.serviceCatalog.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });
    if (!catalog?.isActive) {
      return res.status(404).json({ error: 'Service type not found or inactive' });
    }
    const pkg = await prisma.providerServicePackage.findFirst({
      where: {
        serviceCatalogId: id,
        isActive: true,
        archivedAt: null,
      },
      orderBy: { finalPrice: 'asc' },
      include: {
        bom: {
          orderBy: { sortOrder: 'asc' },
          select: {
            quantity: true,
            snapshotUnitPrice: true,
            snapshotProductName: true,
          },
        },
      },
    });
    if (!pkg) {
      return res.json({ id: catalog.id, name: catalog.name });
    }
    const lines = pkg.bom.map((b) => ({
      item: b.snapshotProductName,
      qty: b.quantity,
      unitPrice: b.snapshotUnitPrice,
    }));
    return res.json({
      id: catalog.id,
      name: catalog.name,
      price: pkg.finalPrice,
      ...(lines.length > 0 ? { bom: { lines } } : {}),
    });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// ─── Staff Assignment Endpoints ───────────────────────────────────────────────

// POST /api/service-catalog/packages/:packageId/assign-staff — Assign staff to a package
router.post('/packages/:packageId/assign-staff', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { packageId } = req.params;
    const { staffId, isPrimary } = req.body;

    if (!staffId) {
      return res.status(400).json({ error: 'Missing staffId' });
    }

    // Verify the package exists and user has access
    const pkg = await prisma.providerServicePackage.findUnique({
      where: { id: packageId },
      include: { workspace: { select: { id: true, ownerId: true } } },
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Check ownership
    const isOwner = pkg.workspace.ownerId === req.user!.userId;
    const isAdmin = ['platform_admin', 'owner', 'support', 'finance'].includes(req.user!.role);
    if (!isOwner && !isAdmin) {
      const membership = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: pkg.workspace.id, userId: req.user!.userId } },
      });
      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    // Check staff is a member of the workspace
    const staffMember = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: pkg.workspace.id, userId: staffId } },
    });
    if (!staffMember) {
      return res.status(400).json({ error: 'Staff member not found in this workspace' });
    }

    // If isPrimary, unset other primary assignments for this package
    if (isPrimary) {
      await prisma.packageStaffAssignment.updateMany({
        where: { packageId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const assignment = await prisma.packageStaffAssignment.upsert({
      where: { packageId_staffId: { packageId, staffId } },
      update: { isPrimary: isPrimary ?? false },
      create: { packageId, staffId, isPrimary: isPrimary ?? false },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json(assignment);
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// DELETE /api/service-catalog/packages/:packageId/assign-staff/:staffId — Remove staff assignment
router.delete('/packages/:packageId/assign-staff/:staffId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { packageId, staffId } = req.params;

    const pkg = await prisma.providerServicePackage.findUnique({
      where: { id: packageId },
      include: { workspace: { select: { id: true, ownerId: true } } },
    });

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    const isOwner = pkg.workspace.ownerId === req.user!.userId;
    const isAdmin = ['platform_admin', 'owner', 'support', 'finance'].includes(req.user!.role);
    if (!isOwner && !isAdmin) {
      const membership = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: pkg.workspace.id, userId: req.user!.userId } },
      });
      if (!membership || (membership.role !== 'admin' && membership.role !== 'owner')) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    await prisma.packageStaffAssignment.delete({
      where: { packageId_staffId: { packageId, staffId } },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

// GET /api/service-catalog/packages/:packageId/staff — Get staff assigned to a package
router.get('/packages/:packageId/staff', async (req: Request, res: Response) => {
  try {
    const { packageId } = req.params;

    const assignments = await prisma.packageStaffAssignment.findMany({
      where: { packageId },
      include: {
        staff: {
          select: {
            id: true,
            displayName: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
    });

    const staff = assignments.map((a) => ({
      id: a.staff.id,
      displayName: a.staff.displayName,
      firstName: a.staff.firstName,
      lastName: a.staff.lastName,
      avatarUrl: a.staff.avatarUrl,
      bio: a.staff.bio,
      isPrimary: a.isPrimary,
      assignedAt: a.createdAt,
    }));

    res.json({ staff });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
  }
});

export default router;
