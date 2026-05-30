import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/db.js';
import { authenticate, AuthRequest } from '../lib/auth.middleware.js';
import { assertWorkspaceMember, WorkspaceAccessError } from '../lib/workspaceAccess.js';

const router = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createInvoiceSchema = z.object({
  customerId: z.string().optional(),
  orderId: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().int().min(0), // cents
  })).min(1),
  tax: z.number().int().min(0).default(0),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateInvoiceSchema = z.object({
  lineItems: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().int().min(0),
  })).optional(),
  tax: z.number().int().min(0).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

const listInvoicesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  customerId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeSubtotal(lineItems: { quantity: number; unitPrice: number }[]): number {
  return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function serializeInvoice(invoice: Record<string, unknown>) {
  return {
    id: invoice.id,
    workspaceId: invoice.workspaceId,
    customerId: invoice.customerId,
    customer: invoice.customer ?? null,
    orderId: invoice.orderId,
    status: invoice.status,
    lineItems: invoice.lineItems,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    dueDate: (invoice.dueDate as Date | null)?.toISOString() ?? null,
    sentAt: (invoice.sentAt as Date | null)?.toISOString() ?? null,
    paidAt: (invoice.paidAt as Date | null)?.toISOString() ?? null,
    pdfUrl: invoice.pdfUrl ?? null,
    notes: invoice.notes ?? null,
    createdAt: (invoice.createdAt as Date).toISOString(),
    updatedAt: (invoice.updatedAt as Date).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// GET /api/workspace/:workspaceId/invoices — List invoices
router.get('/:workspaceId/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const query = listInvoicesSchema.parse(req.query);
    const where: Record<string, unknown> = {
      workspaceId,
      archivedAt: null,
    };

    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(query.dateFrom);
      if (query.dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(query.dateTo);
    }
    if (query.search) {
      where.customer = {
        OR: [
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: where as any,
        include: {
          customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where: where as any }),
    ]);

    res.json({
      data: invoices.map(serializeInvoice),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: err.flatten() });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// POST /api/workspace/:workspaceId/invoices — Create invoice
router.post('/:workspaceId/invoices', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const input = createInvoiceSchema.parse(req.body);
    const subtotal = computeSubtotal(input.lineItems);
    const total = subtotal + input.tax;

    const invoice = await prisma.invoice.create({
      data: {
        workspaceId,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        lineItems: input.lineItems,
        subtotal,
        tax: input.tax,
        total,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        notes: input.notes ?? null,
        status: 'DRAFT',
      },
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.status(201).json({ data: serializeInvoice(invoice) });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid invoice data', details: err.flatten() });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// GET /api/workspace/:workspaceId/invoices/:id — Invoice detail
router.get('/:workspaceId/invoices/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true, address: true, phone: true } },
        order: { select: { id: true, status: true, serviceCatalog: { select: { name: true } } } },
        workspace: { select: { id: true, name: true, logoUrl: true, address: true, phone: true } },
      },
    });

    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    res.json({ data: serializeInvoice(invoice) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// PUT /api/workspace/:workspaceId/invoices/:id — Update draft invoice
router.put('/:workspaceId/invoices/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    if (invoice.status !== 'DRAFT') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Only draft invoices can be updated' });
    }

    const input = updateInvoiceSchema.parse(req.body);
    const data: Record<string, unknown> = {};

    if (input.lineItems) {
      data.lineItems = input.lineItems;
      const newSubtotal = computeSubtotal(input.lineItems);
      data.subtotal = newSubtotal;
      data.total = newSubtotal + (input.tax ?? invoice.tax);
    }
    if (input.tax !== undefined) {
      data.tax = input.tax;
      const currentSubtotal = (data.subtotal as number) ?? invoice.subtotal;
      data.total = currentSubtotal + input.tax;
    }
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status) data.status = input.status;

    const updated = await prisma.invoice.update({
      where: { id },
      data,
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({ data: serializeInvoice(updated) });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Invalid invoice data', details: err.flatten() });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// POST /api/workspace/:workspaceId/invoices/:id/send — Send invoice to customer
router.post('/:workspaceId/invoices/:id/send', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    if (invoice.status !== 'DRAFT' && invoice.status !== 'OVERDUE') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Invoice cannot be sent in its current status' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    // TODO: Integrate with email service to actually send the invoice PDF
    // For now, mark as sent and return the updated invoice

    res.json({ data: serializeInvoice(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// PUT /api/workspace/:workspaceId/invoices/:id/mark-paid — Mark as paid
router.put('/:workspaceId/invoices/:id/mark-paid', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    if (invoice.status !== 'SENT' && invoice.status !== 'OVERDUE') {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'Only sent or overdue invoices can be marked as paid' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
      include: {
        customer: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
      },
    });

    res.json({ data: serializeInvoice(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// DELETE /api/workspace/:workspaceId/invoices/:id — Cancel (soft-delete)
router.delete('/:workspaceId/invoices/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        archivedAt: new Date(),
      },
    });

    res.json({ data: serializeInvoice(updated) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// GET /api/workspace/:workspaceId/invoices/:id/pdf — Generate and return PDF
router.get('/:workspaceId/invoices/:id/pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, id } = req.params;
    const userId = req.user!.userId;

    try {
      await assertWorkspaceMember(userId, workspaceId);
    } catch (e) {
      if (e instanceof WorkspaceAccessError) {
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Not a workspace member' });
      }
      throw e;
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, displayName: true, email: true, address: true, phone: true } },
        workspace: { select: { id: true, name: true, logoUrl: true, address: true, phone: true, website: true, licenseNumber: true } },
      },
    });

    if (!invoice || invoice.workspaceId !== workspaceId) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Invoice not found' });
    }

    // Use the existing invoice generator or build a simple one for standalone invoices
    const { generateInvoicePdf } = await import('../lib/invoiceGenerator.js');

    let pdfBuffer: Buffer;
    try {
      // If invoice has an order, use the order-based generator
      if (invoice.orderId) {
        pdfBuffer = await generateInvoicePdf(invoice.orderId);
      } else {
        // For standalone invoices, generate a simple PDF
        pdfBuffer = await generateStandaloneInvoicePdf(invoice);
      }
    } catch (genErr) {
      // Fallback: generate a simple PDF if order-based generation fails
      pdfBuffer = await generateStandaloneInvoicePdf(invoice);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${id.substring(0, 8)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ code: 'INTERNAL_ERROR', message });
  }
});

// ---------------------------------------------------------------------------
// Standalone invoice PDF generator (for invoices without an order)
// ---------------------------------------------------------------------------

async function generateStandaloneInvoicePdf(invoice: Record<string, unknown>): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const margin = 50;
  let y = 50;

  // Header
  doc.font('Helvetica-Bold').fontSize(20).fillColor('#1a365d');
  doc.text('INVOICE', margin, y);
  y += 30;

  doc.font('Helvetica').fontSize(10).fillColor('#718096');
  doc.text(`Invoice #: ${String(invoice.id ?? '').substring(0, 8) || 'N/A'}`, margin, y);
  y += 14;
  doc.text(`Date: ${(invoice.createdAt as Date)?.toISOString().split('T')[0] ?? 'N/A'}`, margin, y);
  y += 14;
  doc.text(`Status: ${invoice.status}`, margin, y);
  y += 14;
  if (invoice.dueDate) {
    doc.text(`Due Date: ${(invoice.dueDate as Date).toISOString().split('T')[0]}`, margin, y);
    y += 14;
  }
  y += 20;

  // From / To
  const ws = invoice.workspace as Record<string, unknown> | undefined;
  const cust = invoice.customer as Record<string, unknown> | undefined;

  if (ws) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a202c');
    doc.text('From:', margin, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(`${ws.name ?? ''}`, margin + 10, y + 14);
    if (ws.address) doc.text(`${ws.address}`, margin + 10, y + 28);
    if (ws.phone) doc.text(`Phone: ${ws.phone}`, margin + 10, y + 42);
    y += 60;
  }

  if (cust) {
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('To:', margin, y);
    doc.font('Helvetica').fontSize(10);
    doc.text(`${cust.displayName ?? ''}`, margin + 10, y + 14);
    if (cust.email) doc.text(`${cust.email}`, margin + 10, y + 28);
    if (cust.address) doc.text(`${cust.address}`, margin + 10, y + 42);
    y += 60;
  }

  y += 10;

  // Line items table
  const tableTop = y;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff');
  doc.rect(margin, tableTop, 500, 20).fill('#1a365d');

  doc.fillColor('#ffffff');
  doc.text('Description', margin + 5, tableTop + 4, { width: 240 });
  doc.text('Qty', margin + 250, tableTop + 4, { width: 50, align: 'right' });
  doc.text('Unit Price', margin + 310, tableTop + 4, { width: 80, align: 'right' });
  doc.text('Amount', margin + 400, tableTop + 4, { width: 100, align: 'right' });

  y = tableTop + 22;
  const lineItems = invoice.lineItems as Array<{ description: string; quantity: number; unitPrice: number }>;

  doc.font('Helvetica').fontSize(10).fillColor('#1a202c');
  for (const item of lineItems) {
    const amount = item.quantity * item.unitPrice;
    doc.text(item.description, margin + 5, y, { width: 240 });
    doc.text(String(item.quantity), margin + 250, y, { width: 50, align: 'right' });
    doc.text(`$${(item.unitPrice / 100).toFixed(2)}`, margin + 310, y, { width: 80, align: 'right' });
    doc.text(`$${(amount / 100).toFixed(2)}`, margin + 400, y, { width: 100, align: 'right' });
    y += 20;
  }

  y += 10;

  // Totals
  doc.rect(margin + 300, y, 200, 60).stroke('#e2e8f0');
  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal:', margin + 310, y + 8, { width: 80 });
  doc.text(`$${((invoice.subtotal as number || 0) / 100).toFixed(2)}`, margin + 400, y + 8, { width: 100, align: 'right' });
  doc.text('Tax:', margin + 310, y + 24, { width: 80 });
  doc.text(`$${((invoice.tax as number || 0) / 100).toFixed(2)}`, margin + 400, y + 24, { width: 100, align: 'right' });

  doc.font('Helvetica-Bold');
  doc.text('Total:', margin + 310, y + 40, { width: 80 });
  doc.text(`$${((invoice.total as number || 0) / 100).toFixed(2)}`, margin + 400, y + 40, { width: 100, align: 'right' });

  y += 75;

  // Notes
  if (invoice.notes) {
    doc.font('Helvetica').fontSize(9).fillColor('#718096');
    doc.text(`Notes: ${invoice.notes}`, margin, y);
  }

  // Footer
  y = doc.page.height - 60;
  doc.rect(margin, y - 10, 495, 0.5).fill('#e2e8f0');
  doc.font('Helvetica').fontSize(9).fillColor('#718096');
  doc.text('Thank you for your business!', margin, y, { width: 495, align: 'center' });

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    const allChunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => allChunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(allChunks)));
    doc.on('error', reject);
  });
}

export default router;