import { Router, Response, NextFunction } from 'express';
import { QuoteStatus } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';
import { resolveEffectiveBookingMode } from '../lib/matching/eligibility.js';
import { publish } from '../lib/bus.js';

const router = Router();

// ---------------------------------------------------------------------------
// Zod validation schemas
// ---------------------------------------------------------------------------

const createQuoteSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().int().nonnegative(), // cents
  })).optional(),
  subtotal: z.number().int().nonnegative(), // cents
  tax: z.number().int().nonnegative(),      // cents
  total: z.number().int().positive(),       // cents
  currency: z.string().max(3).default('CAD'),
  validUntil: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  customerMessage: z.string().max(2000).optional(),
});

const updateQuoteSchema = createQuoteSchema.partial();

const sendQuoteSchema = z.object({}); // no body needed

const acceptQuoteSchema = z.object({}); // no body needed

const rejectQuoteSchema = z.object({
  reason: z.string().max(500).optional(),
});

const counterOfferSchema = z.object({
  amount: z.number().int().positive("amount must be a positive integer (cents)"),
  description: z.string().min(20).optional(),
});

type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
type RejectQuoteInput = z.infer<typeof rejectQuoteSchema>;
type CounterOfferInput = z.infer<typeof counterOfferSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Verify that the order is in `quote_first` booking mode and `matching` status.
 * Returns a 400 response with INVALID_ORDER_STATE code if not.
 */
async function assertOrderIsQuoteFirst(
  orderId: string,
  res: Response,
): Promise<{ order: { id: string; customerId: string; matchedWorkspaceId: string | null; matchedProviderId: string | null; serviceCatalogId: string | null } } | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      status: true,
      matchedWorkspaceId: true,
      matchedProviderId: true,
      serviceCatalogId: true,
      matchedPackageId: true,
    },
  });

  if (!order) {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
    return null;
  }

  if (order.status !== 'matching') {
    res.status(400).json({ code: 'INVALID_ORDER_STATE', message: `Order must be in 'matching' status, got '${order.status}'` });
    return null;
  }

  // Resolve effective booking mode from the matched package or service catalog
  let effectiveMode: string | null = null;

  if (order.matchedPackageId) {
    const pkg = await prisma.providerServicePackage.findUnique({
      where: { id: order.matchedPackageId },
      select: { bookingMode: true },
    });
    if (pkg) {
      const catalog = order.serviceCatalogId
        ? await prisma.serviceCatalog.findUnique({
            where: { id: order.serviceCatalogId },
            select: { lockedBookingMode: true },
          })
        : null;
      effectiveMode = resolveEffectiveBookingMode(
        { lockedBookingMode: catalog?.lockedBookingMode ?? null },
        { bookingMode: pkg.bookingMode },
      );
    }
  }

  if (effectiveMode !== 'quote_first') {
    res.status(400).json({ code: 'INVALID_ORDER_STATE', message: `Order is not in quote_first booking mode (resolved: ${effectiveMode ?? 'unknown'})` });
    return null;
  }

  return { order: { id: order.id, customerId: order.customerId, matchedWorkspaceId: order.matchedWorkspaceId, matchedProviderId: order.matchedProviderId, serviceCatalogId: order.serviceCatalogId } };
}

// ---------------------------------------------------------------------------
// GET /api/orders/:orderId/quotes — List quotes for an order
// ---------------------------------------------------------------------------
router.get('/order/:orderId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, matchedWorkspaceId: true },
    });
    if (!order) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    // Only customer or workspace members can view quotes
    const isCustomer = order.customerId === userId;
    let isMember = false;
    if (order.matchedWorkspaceId) {
      try {
        await assertWorkspaceMember(userId, order.matchedWorkspaceId);
        isMember = true;
      } catch (e) {
        if (!(e instanceof WorkspaceAccessError)) throw e;
      }
    }

    if (!isCustomer && !isMember) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized to view quotes for this order' });
    }

    const quotes = await prisma.quote.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json({ data: quotes });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/orders/:orderId/quotes — Create a new quote (workspace member only)
// ---------------------------------------------------------------------------
router.post('/order/:orderId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const userId = req.user!.userId;

    // Validate order is in quote_first mode and matching state
    const orderCheck = await assertOrderIsQuoteFirst(orderId, res);
    if (!orderCheck) return;

    const { order } = orderCheck;

    if (!order.matchedWorkspaceId) {
      return res.status(400).json({ code: 'NO_WORKSPACE', message: 'Order has no matched workspace' });
    }

    // Verify user is a workspace member
    try {
      await assertWorkspaceMember(userId, order.matchedWorkspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Only workspace members can create quotes' });
      }
      throw e;
    }

    // Validate body
    const parseResult = createQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const body: CreateQuoteInput = parseResult.data;

    // Get the latest version number
    const lastQuote = await prisma.quote.findFirst({
      where: { orderId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastQuote?.versionNumber ?? 0) + 1;

    const quote = await prisma.quote.create({
      data: {
        orderId,
        workspaceId: order.matchedWorkspaceId,
        createdById: userId,
        versionNumber,
        status: QuoteStatus.DRAFT,
        title: body.title ?? `Quote #${versionNumber}`,
        description: body.description ?? null,
        lineItems: body.lineItems ?? [],
        subtotal: body.subtotal,
        tax: body.tax,
        total: body.total,
        currency: body.currency,
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        notes: body.notes ?? null,
        customerMessage: body.customerMessage ?? null,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ data: quote });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/quotes/:quoteId — Get single quote detail
// ---------------------------------------------------------------------------
router.get('/:quoteId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user!.userId;

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        order: { select: { id: true, customerId: true, matchedWorkspaceId: true } },
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!quote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    // Authorization: customer or workspace member
    const isCustomer = quote.order.customerId === userId;
    let isMember = false;
    if (quote.order.matchedWorkspaceId) {
      try {
        await assertWorkspaceMember(userId, quote.order.matchedWorkspaceId);
        isMember = true;
      } catch (e) {
        if (!(e instanceof WorkspaceAccessError)) throw e;
      }
    }
    if (!isCustomer && !isMember) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Not authorized' });
    }

    res.json({ data: quote });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /api/quotes/:quoteId — Update draft quote
// ---------------------------------------------------------------------------
router.put('/:quoteId', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user!.userId;

    const existing = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { matchedWorkspaceId: true } } },
    });
    if (!existing) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }
    if (existing.status !== QuoteStatus.DRAFT) {
      return res.status(400).json({ code: 'INVALID_STATE', message: 'Only draft quotes can be edited' });
    }

    // Verify workspace membership
    if (existing.order.matchedWorkspaceId) {
      try {
        await assertWorkspaceMember(userId, existing.order.matchedWorkspaceId);
      } catch (e) {
        if (e instanceof WorkspaceAccessError) {
          return res.status(403).json({ code: 'FORBIDDEN', message: 'Only workspace members can edit quotes' });
        }
        throw e;
      }
    }

    // Validate body
    const parseResult = updateQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const body: UpdateQuoteInput = parseResult.data;

    // Build update data — only include fields that were actually provided
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.lineItems !== undefined) data.lineItems = body.lineItems;
    if (body.subtotal !== undefined) data.subtotal = body.subtotal;
    if (body.tax !== undefined) data.tax = body.tax;
    if (body.total !== undefined) data.total = body.total;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.validUntil !== undefined) data.validUntil = new Date(body.validUntil);
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.customerMessage !== undefined) data.customerMessage = body.customerMessage;

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data,
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:quoteId/send — Send quote to customer (DRAFT → SENT)
// ---------------------------------------------------------------------------
router.post('/:quoteId/send', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user!.userId;

    // Validate body (empty)
    const parseResult = sendQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { matchedWorkspaceId: true, customerId: true } } },
    });
    if (!quote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }
    if (quote.status !== QuoteStatus.DRAFT) {
      return res.status(400).json({ code: 'INVALID_STATE', message: 'Only draft quotes can be sent' });
    }

    // Verify workspace membership
    if (quote.order.matchedWorkspaceId) {
      try {
        await assertWorkspaceMember(userId, quote.order.matchedWorkspaceId);
      } catch (e) {
        if (e instanceof WorkspaceAccessError) {
          return res.status(403).json({ code: 'FORBIDDEN', message: 'Only workspace members can send quotes' });
        }
        throw e;
      }
    }

    // Set validUntil to 48 hours from now if not already set
    const validUntil = quote.validUntil ?? new Date(Date.now() + 48 * 60 * 60 * 1000);

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
        validUntil,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Publish event
    try {
      await publish('quotes.sent', {
        quoteId: updated.id,
        orderId: updated.orderId,
        workspaceId: updated.workspaceId,
        customerId: quote.order.customerId,
        total: updated.total,
        currency: updated.currency,
      });
    } catch {
      // Non-fatal: bus may not be available
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:quoteId/accept — Customer accepts quote (SENT → ACCEPTED)
// ---------------------------------------------------------------------------
router.post('/:quoteId/accept', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user!.userId;

    // Validate body (empty)
    const parseResult = acceptQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        order: {
          select: {
            id: true,
            customerId: true,
            matchedWorkspaceId: true,
            matchedProviderId: true,
            serviceCatalogId: true,
          },
        },
      },
    });
    if (!quote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }
    if (quote.status !== QuoteStatus.SENT) {
      return res.status(400).json({ code: 'INVALID_STATE', message: 'Only sent quotes can be accepted' });
    }
    if (quote.order.customerId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the customer can accept quotes' });
    }

    // Update quote status
    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.ACCEPTED,
        respondedAt: new Date(),
      },
    });

    const orderId = quote.order.id;

    // Set Order.budget = quote.total (in cents)
    await prisma.order.update({
      where: { id: orderId },
      data: {
        budget: quote.total,
      },
    });

    // Auto-create contract version from quote
    let orderContract = await prisma.orderContract.findUnique({ where: { orderId } });

    if (!orderContract) {
      orderContract = await prisma.orderContract.create({
        data: { orderId },
      });
    }

    // Build terms markdown from quote line items
    const lineItems = quote.lineItems as Array<{ description: string; quantity: number; unitPrice: number; total: number }> | null;
    let termsMarkdown = `## ${quote.title}\n\n`;
    if (quote.description) {
      termsMarkdown += `${quote.description}\n\n`;
    }
    if (lineItems && lineItems.length > 0) {
      termsMarkdown += '### Line Items\n\n';
      termsMarkdown += '| Description | Quantity | Unit Price | Total |\n';
      termsMarkdown += '|---|---|---|---|\n';
      for (const item of lineItems) {
        // Values are in cents, display as dollars
        const unitPriceDollars = (item.unitPrice / 100).toFixed(2);
        const totalDollars = (item.total / 100).toFixed(2);
        termsMarkdown += `| ${item.description} | ${item.quantity} | $${unitPriceDollars} | $${totalDollars} |\n`;
      }
      termsMarkdown += '\n';
    }
    const subtotalDollars = (quote.subtotal / 100).toFixed(2);
    const taxDollars = (quote.tax / 100).toFixed(2);
    const totalDollars = (quote.total / 100).toFixed(2);
    termsMarkdown += `**Subtotal:** $${subtotalDollars}\n`;
    if (quote.tax > 0) {
      termsMarkdown += `**Tax:** $${taxDollars}\n`;
    }
    termsMarkdown += `**Total:** $${totalDollars} ${quote.currency}\n`;
    if (quote.notes) {
      termsMarkdown += `\n**Notes:** ${quote.notes}\n`;
    }

    // Get latest version number
    const lastVersion = await prisma.contractVersion.findFirst({
      where: { contractId: orderContract.id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const contractVersion = await prisma.contractVersion.create({
      data: {
        contractId: orderContract.id,
        versionNumber,
        status: 'sent',
        title: quote.title,
        termsMarkdown,
        amount: quote.total,
        currency: quote.currency,
      },
    });

    // Set as current version
    await prisma.orderContract.update({
      where: { id: orderContract.id },
      data: { currentVersionId: contractVersion.id },
    });

    // Create contract event
    await prisma.contractEvent.create({
      data: {
        contractId: orderContract.id,
        actionType: 'provider_sent',
        actorId: quote.createdById,
        actorRole: 'provider',
        note: `Quote #${quote.versionNumber} accepted — contract version ${versionNumber} created`,
      },
    });

    // Update order status to contracted
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'contracted' },
    });

    // Publish event
    try {
      await publish('quotes.accepted', {
        quoteId: updated.id,
        orderId,
        workspaceId: quote.workspaceId,
        customerId: quote.order.customerId,
        total: quote.total,
        currency: quote.currency,
      });
    } catch {
      // Non-fatal: bus may not be available
    }

    res.json({
      data: {
        ...updated,
        contractVersionId: contractVersion.id,
        orderContractId: orderContract.id,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:quoteId/reject — Customer rejects quote (SENT → REJECTED)
// ---------------------------------------------------------------------------
router.post('/:quoteId/reject', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user!.userId;

    // Validate body
    const parseResult = rejectQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const body: RejectQuoteInput = parseResult.data;

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      include: { order: { select: { id: true, customerId: true } } },
    });
    if (!quote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }
    if (quote.status !== QuoteStatus.SENT) {
      return res.status(400).json({ code: 'INVALID_STATE', message: 'Only sent quotes can be rejected' });
    }
    if (quote.order.customerId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the customer can reject quotes' });
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: QuoteStatus.REJECTED,
        respondedAt: new Date(),
        rejectionReason: body.reason ?? null,
      },
    });

    // Return order to matching state so other providers can submit quotes
    await prisma.order.update({
      where: { id: quote.order.id },
      data: { status: 'matching' },
    });

    // Publish event
    try {
      await publish('quotes.rejected', {
        quoteId: updated.id,
        orderId: quote.order.id,
        workspaceId: quote.workspaceId,
        customerId: quote.order.customerId,
        total: quote.total,
        currency: quote.currency,
        reason: body.reason ?? null,
      });
    } catch {
      // Non-fatal: bus may not be available
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:id/counter — Provider submits a counter-offer (SENT → new pending quote)
// ---------------------------------------------------------------------------
router.post('/:id/counter', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Validate body
    const parseResult = counterOfferSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const body: CounterOfferInput = parseResult.data;

    // Find the original quote
    const originalQuote = await prisma.quote.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            customerId: true,
            status: true,
            matchedWorkspaceId: true,
            matchedProviderId: true,
            serviceCatalogId: true,
            matchedPackageId: true,
          },
        },
      },
    });

    if (!originalQuote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    // Verify the original quote belongs to a quote_first order
    if (originalQuote.order.status !== 'matching') {
      return res.status(400).json({
        code: 'INVALID_ORDER_STATE',
        message: `Order must be in 'matching' status, got '${originalQuote.order.status}'`,
      });
    }

    // Resolve effective booking mode
    let effectiveMode: string | null = null;
    if (originalQuote.order.matchedPackageId) {
      const pkg = await prisma.providerServicePackage.findUnique({
        where: { id: originalQuote.order.matchedPackageId },
        select: { bookingMode: true },
      });
      if (pkg) {
        const catalog = originalQuote.order.serviceCatalogId
          ? await prisma.serviceCatalog.findUnique({
              where: { id: originalQuote.order.serviceCatalogId },
              select: { lockedBookingMode: true },
            })
          : null;
        effectiveMode = resolveEffectiveBookingMode(
          { lockedBookingMode: catalog?.lockedBookingMode ?? null },
          { bookingMode: pkg.bookingMode },
        );
      }
    }

    if (effectiveMode !== 'quote_first') {
      return res.status(400).json({
        code: 'INVALID_ORDER_STATE',
        message: `Order is not in quote_first booking mode (resolved: ${effectiveMode ?? 'unknown'})`,
      });
    }

    // Verify the original quote is in SENT status
    if (originalQuote.status !== QuoteStatus.SENT) {
      return res.status(400).json({
        code: 'INVALID_STATE',
        message: `Only sent quotes can be countered, got '${originalQuote.status}'`,
      });
    }

    // Verify the requesting user is the provider who created the original quote
    if (originalQuote.createdById !== userId) {
      return res.status(403).json({
        code: 'FORBIDDEN',
        message: 'Only the provider who created the original quote can submit a counter-offer',
      });
    }

    // Get the latest version number for this order
    const lastQuote = await prisma.quote.findFirst({
      where: { orderId: originalQuote.orderId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (lastQuote?.versionNumber ?? 0) + 1;

    // Create the counter-offer quote
    const counterQuote = await prisma.quote.create({
      data: {
        orderId: originalQuote.orderId,
        workspaceId: originalQuote.workspaceId,
        createdById: userId,
        versionNumber,
        status: QuoteStatus.SENT,
        title: `Counter-offer #${versionNumber}`,
        description: body.description ?? null,
        lineItems: [],
        subtotal: body.amount,
        tax: 0,
        total: body.amount,
        currency: originalQuote.currency,
        validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
        counterOfferTo: originalQuote.id,
      },
      include: {
        createdBy: { select: { id: true, displayName: true, avatarUrl: true } },
      },
    });

    // Publish NATS event
    try {
      await publish('quote.countered', {
        quoteId: counterQuote.id,
        originalQuoteId: originalQuote.id,
        orderId: originalQuote.orderId,
        workspaceId: originalQuote.workspaceId,
        providerId: userId,
        customerId: originalQuote.order.customerId,
        amount: body.amount,
        currency: originalQuote.currency,
      });
    } catch {
      // Non-fatal: bus may not be available
    }

    res.status(201).json({ data: counterQuote });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/quotes/:id/respond — Customer accepts or rejects a counter-offer
// ---------------------------------------------------------------------------
const respondToQuoteSchema = z.object({
  action: z.enum(['accept', 'reject']),
  reason: z.string().max(500).optional(),
});

router.post('/:id/respond', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    // Validate body
    const parseResult = respondToQuoteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }

    const { action, reason } = parseResult.data;

    // Find the quote — include its counterOfferTo relation to trace the chain
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, customerId: true, matchedWorkspaceId: true } },
        counterOfferToQuote: {
          select: { id: true, status: true, orderId: true },
        },
      },
    });

    if (!quote) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Quote not found' });
    }

    // Only the customer can respond
    if (quote.order.customerId !== userId) {
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Only the customer can respond to quotes' });
    }

    // Verify the quote is in SENT status
    if (quote.status !== QuoteStatus.SENT) {
      return res.status(400).json({
        code: 'INVALID_STATE',
        message: `Only sent quotes can be responded to, got '${quote.status}'`,
      });
    }

    if (action === 'accept') {
      // Accept the counter-offer
      const updated = await prisma.quote.update({
        where: { id },
        data: {
          status: QuoteStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });

      // Reject all other pending (SENT) quotes for the same order
      await prisma.quote.updateMany({
        where: {
          orderId: quote.orderId,
          id: { not: id },
          status: QuoteStatus.SENT,
        },
        data: {
          status: QuoteStatus.REJECTED,
          respondedAt: new Date(),
          rejectionReason: 'Another quote was accepted',
        },
      });

      // Transition order to contracted
      await prisma.order.update({
        where: { id: quote.orderId },
        data: { status: 'contracted' },
      });

      // Publish event
      try {
        await publish('quotes.accepted', {
          quoteId: updated.id,
          orderId: quote.orderId,
          workspaceId: quote.workspaceId,
          customerId: quote.order.customerId,
          total: updated.total,
          currency: updated.currency,
        });
      } catch {
        // Non-fatal
      }

      return res.json({ data: updated });
    }

    // --- action === 'reject' ---
    const updated = await prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.REJECTED,
        respondedAt: new Date(),
        rejectionReason: reason ?? null,
      },
    });

    // If this was a counter-offer (has counterOfferTo), the original quote
    // remains in SENT status so the customer can still accept it
    if (!quote.counterOfferToQuote) {
      // Not a counter-offer — return order to matching state
      await prisma.order.update({
        where: { id: quote.orderId },
        data: { status: 'matching' },
      });
    }
    // If it IS a counter-offer, the original quote stays SENT for potential acceptance

    // Publish event
    try {
      await publish('quotes.rejected', {
        quoteId: updated.id,
        orderId: quote.orderId,
        workspaceId: quote.workspaceId,
        customerId: quote.order.customerId,
        total: updated.total,
        currency: updated.currency,
        reason: reason ?? null,
      });
    } catch {
      // Non-fatal
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
