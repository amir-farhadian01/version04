import { Router, Response } from 'express';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';

const router = Router();

// GET /api/workspace/:workspaceId/crm/customers — List customers with order aggregation
router.get('/:workspaceId/crm/customers', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

    // Find all distinct customers who have orders with this workspace
    const customerWhere: any = {
      ordersAsCustomer: {
        some: { matchedWorkspaceId: workspaceId },
      },
    };

    if (search) {
      customerWhere.OR = [
        { displayName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where: customerWhere,
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          phone: true,
          ordersAsCustomer: {
            where: { matchedWorkspaceId: workspaceId },
            select: {
              id: true,
              status: true,
              updatedAt: true,
              orderContract: {
                select: {
                  currentVersion: { select: { amount: true, currency: true } },
                },
              },
              matchedPackage: { select: { finalPrice: true, currency: true } },
            },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { displayName: 'asc' },
      }),
      prisma.user.count({ where: customerWhere }),
    ]);

    // Aggregate order data per customer
    const customerRows = customers.map((c) => {
      const orders = c.ordersAsCustomer;
      let totalSpent = 0;
      let completedCount = 0;
      let lastOrderDate: string | null = null;

      for (const o of orders) {
        const amount = o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? 0;
        totalSpent += amount;
        if (o.status === 'completed' || o.status === 'closed') {
          completedCount += 1;
        }
        const updated = o.updatedAt.toISOString();
        if (!lastOrderDate || updated > lastOrderDate) {
          lastOrderDate = updated;
        }
      }

      return {
        id: c.id,
        displayName: c.displayName,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        avatarUrl: c.avatarUrl,
        phone: c.phone,
        totalOrders: orders.length,
        totalSpent,
        completedOrders: completedCount,
        lastOrderDate,
      };
    });

    res.json({ data: customerRows, total, page, pageSize });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/workspace/:workspaceId/crm/customers/:customerId — Customer detail with order history
router.get('/:workspaceId/crm/customers/:customerId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, customerId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const [customer, orders, notes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          phone: true,
          createdAt: true,
        },
      }),
      prisma.order.findMany({
        where: { customerId, matchedWorkspaceId: workspaceId },
        include: {
          serviceCatalog: { select: { name: true } },
          matchedPackage: { select: { name: true, finalPrice: true, currency: true } },
          orderContract: {
            select: {
              currentVersion: { select: { amount: true, currency: true, status: true } },
            },
          },
          customerReview: { select: { rating: true, reviewText: true, createdAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.workspaceCustomerNote.findMany({
        where: { workspaceId, customerId, archivedAt: null },
        include: {
          author: { select: { id: true, displayName: true, avatarUrl: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const orderSummaries = orders.map((o) => ({
      id: o.id,
      serviceName: o.serviceCatalog.name,
      packageName: o.matchedPackage?.name ?? null,
      amount: o.orderContract?.currentVersion?.amount ?? o.matchedPackage?.finalPrice ?? 0,
      currency: o.orderContract?.currentVersion?.currency ?? o.matchedPackage?.currency ?? 'CAD',
      status: o.status,
      contractStatus: o.orderContract?.currentVersion?.status ?? null,
      createdAt: o.createdAt.toISOString(),
      updatedAt: o.updatedAt.toISOString(),
      review: o.customerReview
        ? { rating: o.customerReview.rating, text: o.customerReview.reviewText, createdAt: o.customerReview.createdAt.toISOString() }
        : null,
    }));

    res.json({
      customer,
      orders: orderSummaries,
      notes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/workspace/:workspaceId/crm/customers/:customerId/notes — Add internal note
router.post('/:workspaceId/crm/customers/:customerId/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, customerId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const { content } = req.body as { content?: string };
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const note = await prisma.workspaceCustomerNote.create({
      data: {
        workspaceId,
        customerId,
        authorId: userId,
        content: content.trim(),
      },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json(note);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/workspace/:workspaceId/crm/customers/:customerId/notes — Get internal notes
router.get('/:workspaceId/crm/customers/:customerId/notes', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, customerId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const notes = await prisma.workspaceCustomerNote.findMany({
      where: { workspaceId, customerId, archivedAt: null },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ data: notes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PUT /api/workspace/:workspaceId/crm/notes/:noteId — Update note
router.put('/:workspaceId/crm/notes/:noteId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, noteId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const note = await prisma.workspaceCustomerNote.findUnique({ where: { id: noteId } });
    if (!note || note.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { content } = req.body as { content?: string };
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }

    const updated = await prisma.workspaceCustomerNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
      include: {
        author: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json(updated);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/workspace/:workspaceId/crm/notes/:noteId — Soft-delete note
router.delete('/:workspaceId/crm/notes/:noteId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, noteId } = req.params;
    const userId = req.user!.userId;

    // Verify workspace membership
    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ error: 'Not a workspace member' });
      }
      throw e;
    }

    const note = await prisma.workspaceCustomerNote.findUnique({ where: { id: noteId } });
    if (!note || note.workspaceId !== workspaceId) {
      return res.status(404).json({ error: 'Note not found' });
    }

    await prisma.workspaceCustomerNote.update({
      where: { id: noteId },
      data: { archivedAt: new Date() },
    });

    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
