import PDFDocument from 'pdfkit';
import prisma from './db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderForInvoice = NonNullable<Awaited<ReturnType<typeof queryOrderForInvoice>>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert cents to a formatted dollar string.
 * @example formatCents(150000) → "$1,500.00"
 */
export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Return a standardised invoice filename for a given order ID.
 * @example getInvoiceFilename('cm7abc123...') → "invoice-cm7abc12.pdf"
 */
export function getInvoiceFilename(orderId: string): string {
  return `invoice-${orderId.substring(0, 8)}.pdf`;
}

// ---------------------------------------------------------------------------
// Internal query
// ---------------------------------------------------------------------------

async function queryOrderForInvoice(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: {
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          email: true,
          address: true,
          phone: true,
        },
      },
      matchedProvider: {
        select: {
          id: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
      matchedWorkspace: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          address: true,
          phone: true,
          website: true,
          licenseNumber: true,
        },
      },
      serviceCatalog: {
        select: {
          id: true,
          name: true,
          category: true,
          description: true,
        },
      },
      matchedPackage: {
        select: {
          id: true,
          name: true,
          finalPrice: true,
          currency: true,
        },
      },
      payment: true,
      invoice: true,
      jobRecord: true,
    },
  });
}

// ---------------------------------------------------------------------------
// PDF generation helpers
// ---------------------------------------------------------------------------

const COLORS = {
  header: '#1a365d',
  secondary: '#718096',
  border: '#e2e8f0',
  black: '#1a202c',
};

const FONT_SIZES = {
  title: 24,
  sectionHeader: 14,
  body: 10,
  footer: 8,
};

/**
 * Draw a horizontal separator line.
 */
function drawSeparator(doc: PDFKit.PDFDocument, y: number, margin = 50, rightMargin?: number): void {
  doc
    .moveTo(margin, y)
    .lineTo(rightMargin ?? doc.page.width - margin, y)
    .strokeColor(COLORS.border)
    .stroke();
}

/**
 * Draw a simple table row with columns.
 */
function drawTableRow(
  doc: PDFKit.PDFDocument,
  y: number,
  columns: { text: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[],
  opts: { fontSize?: number; bold?: boolean; color?: string; drawBorder?: boolean } = {},
): void {
  const fontSize = opts.fontSize ?? FONT_SIZES.body;
  const color = opts.color ?? COLORS.black;

  if (opts.bold) {
    doc.font('Helvetica-Bold');
  } else {
    doc.font('Helvetica');
  }

  doc.fontSize(fontSize).fillColor(color);

  for (const col of columns) {
    const align = col.align ?? 'left';
    let textX = col.x;

    if (align === 'right') {
      textX = col.x + col.width - doc.widthOfString(col.text);
    } else if (align === 'center') {
      textX = col.x + (col.width - doc.widthOfString(col.text)) / 2;
    }

    doc.text(col.text, textX, y, { width: col.width, align });
  }

  // Bottom border
  if (opts.drawBorder !== false) {
    drawSeparator(doc, y + 16, 50);
  }
}

/**
 * Draw a table header row with dark background styling.
 */
function drawTableHeader(
  doc: PDFKit.PDFDocument,
  y: number,
  columns: { text: string; x: number; width: number; align?: 'left' | 'right' | 'center' }[],
): void {
  // Background bar
  doc
    .rect(50, y - 4, doc.page.width - 100, 20)
    .fillColor(COLORS.header)
    .fill();

  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.body).fillColor('#ffffff');

  for (const col of columns) {
    const align = col.align ?? 'left';
    let textX = col.x;

    if (align === 'right') {
      textX = col.x + col.width - doc.widthOfString(col.text);
    } else if (align === 'center') {
      textX = col.x + (col.width - doc.widthOfString(col.text)) / 2;
    }

    doc.text(col.text, textX, y, { width: col.width, align });
  }
}

// ---------------------------------------------------------------------------
// Main PDF generator
// ---------------------------------------------------------------------------

/**
 * Generate an invoice PDF for a given order.
 *
 * Queries the order with all required relations, builds a professional
 * multi-page PDF document, and returns it as a Buffer.
 *
 * @throws Error if the order is not found or has no payment record.
 */
export async function generateInvoicePdf(orderId: string): Promise<Buffer> {
  const order = await queryOrderForInvoice(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  if (!order.payment) {
    throw new Error('Order has no payment record');
  }

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Invoice ${orderId.substring(0, 8).toUpperCase()}`,
      Author: 'Neighborly',
      Subject: 'Invoice',
    },
  });

  // Collect PDF chunks into a Buffer
  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const payment = order.payment;
  const invoice = order.invoice;
  const workspace = order.matchedWorkspace;
  const customer = order.customer;
  const service = order.serviceCatalog;
  const pkg = order.matchedPackage;
  const jobRecord = order.jobRecord;

  const invoiceNumber = `INV-${orderId.substring(0, 8).toUpperCase()}`;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dueDate = invoice?.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const pageWidth = doc.page.width;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // =========================================================================
  // HEADER
  // =========================================================================

  // Title
  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.title).fillColor(COLORS.header);
  doc.text('INVOICE', margin, 50, { width: contentWidth, align: 'center' });

  // Invoice number & dates
  doc.font('Helvetica').fontSize(FONT_SIZES.body).fillColor(COLORS.black);
  doc.text(`Invoice #: ${invoiceNumber}`, margin, 85, { width: contentWidth, align: 'center' });
  doc.text(`Date: ${todayStr}`, margin, 100, { width: contentWidth, align: 'center' });
  doc.text(`Due Date: ${dueDateStr}`, margin, 115, { width: contentWidth, align: 'center' });

  drawSeparator(doc, 135);

  // =========================================================================
  // PROVIDER (left) & CUSTOMER (right) SECTIONS
  // =========================================================================

  const sectionY = 155;
  const leftColX = margin;
  const rightColX = pageWidth / 2 + 10;
  const colWidth = contentWidth / 2 - 20;

  // --- Provider ---
  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.sectionHeader).fillColor(COLORS.header);
  doc.text('Provider', leftColX, sectionY);

  doc.font('Helvetica').fontSize(FONT_SIZES.body).fillColor(COLORS.black);
  let providerY = sectionY + 22;
  doc.text(workspace?.name ?? 'N/A', leftColX, providerY);
  providerY += 16;
  if (workspace?.address) {
    doc.text(workspace.address, leftColX, providerY);
    providerY += 16;
  }
  if (workspace?.phone) {
    doc.text(`Phone: ${workspace.phone}`, leftColX, providerY);
    providerY += 16;
  }
  if (workspace?.website) {
    doc.text(`Web: ${workspace.website}`, leftColX, providerY);
    providerY += 16;
  }
  if (workspace?.licenseNumber) {
    doc.text(`License: ${workspace.licenseNumber}`, leftColX, providerY);
  }

  // --- Customer ---
  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.sectionHeader).fillColor(COLORS.header);
  doc.text('Bill To', rightColX, sectionY);

  doc.font('Helvetica').fontSize(FONT_SIZES.body).fillColor(COLORS.black);
  let customerY = sectionY + 22;
  const customerName = customer?.displayName
    ? customer.displayName
    : customer
      ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim()
      : 'N/A';
  doc.text(customerName, rightColX, customerY);
  customerY += 16;
  if (customer?.email) {
    doc.text(customer.email, rightColX, customerY);
    customerY += 16;
  }
  if (customer?.phone) {
    doc.text(`Phone: ${customer.phone}`, rightColX, customerY);
    customerY += 16;
  }
  if (customer?.address) {
    doc.text(customer.address, rightColX, customerY);
  }

  // =========================================================================
  // SERVICE DETAILS TABLE
  // =========================================================================

  const tableTop = Math.max(providerY, customerY) + 30;
  drawSeparator(doc, tableTop - 10);

  // Column positions
  const descX = margin;
  const descW = contentWidth * 0.45;
  const qtyX = descX + descW;
  const qtyW = contentWidth * 0.12;
  const priceX = qtyX + qtyW;
  const priceW = contentWidth * 0.2;
  const amountX = priceX + priceW;
  const amountW = contentWidth * 0.23;

  const tableColumns = [
    { text: 'Description', x: descX, width: descW, align: 'left' as const },
    { text: 'Qty', x: qtyX, width: qtyW, align: 'center' as const },
    { text: 'Unit Price', x: priceX, width: priceW, align: 'right' as const },
    { text: 'Amount', x: amountX, width: amountW, align: 'right' as const },
  ];

  drawTableHeader(doc, tableTop, tableColumns);

  let rowY = tableTop + 22;

  // Row 1: Service
  const serviceAmount = payment.amount;
  const serviceUnitPrice = payment.amount;
  const serviceDescription = service
    ? `${service.name}${order.description ? ` — ${order.description}` : ''}`
    : order.description ?? 'Service';

  drawTableRow(doc, rowY, [
    { text: serviceDescription, x: descX, width: descW, align: 'left' },
    { text: '1', x: qtyX, width: qtyW, align: 'center' },
    { text: formatCents(serviceUnitPrice), x: priceX, width: priceW, align: 'right' },
    { text: formatCents(serviceAmount), x: amountX, width: amountW, align: 'right' },
  ]);
  rowY += 22;

  // Row 2: Platform fee (if commission > 0)
  if (payment.commission > 0) {
    drawTableRow(doc, rowY, [
      { text: 'Platform Fee (15%)', x: descX, width: descW, align: 'left' },
      { text: '1', x: qtyX, width: qtyW, align: 'center' },
      { text: formatCents(payment.commission), x: priceX, width: priceW, align: 'right' },
      { text: `-${formatCents(payment.commission)}`, x: amountX, width: amountW, align: 'right' },
    ]);
    rowY += 22;
  }

  // Total row
  drawSeparator(doc, rowY - 4);
  drawTableRow(doc, rowY, [
    { text: '', x: descX, width: descW + qtyW + priceW, align: 'left' },
    { text: 'Total', x: priceX, width: priceW, align: 'right' },
    { text: formatCents(payment.amount), x: amountX, width: amountW, align: 'right' },
  ], { bold: true, drawBorder: true });
  rowY += 22;

  // =========================================================================
  // PAYMENT SECTION
  // =========================================================================

  const paymentSectionY = rowY + 10;
  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.sectionHeader).fillColor(COLORS.header);
  doc.text('Payment Details', margin, paymentSectionY);

  const paymentDetailY = paymentSectionY + 22;
  doc.font('Helvetica').fontSize(FONT_SIZES.body).fillColor(COLORS.black);

  doc.text(`Status: ${payment.status}`, margin, paymentDetailY);
  doc.text(`Amount Paid: ${formatCents(payment.amount)}`, margin, paymentDetailY + 16);

  const paymentDate = jobRecord?.completedAt ?? payment.updatedAt;
  if (paymentDate) {
    doc.text(`Payment Date: ${paymentDate.toISOString().split('T')[0]}`, margin, paymentDetailY + 32);
  }

  if (payment.escrowReleaseAt) {
    doc.text(
      `Escrow Release Date: ${payment.escrowReleaseAt.toISOString().split('T')[0]}`,
      margin,
      paymentDetailY + 48,
    );
  }

  // =========================================================================
  // FOOTER
  // =========================================================================

  const footerY = doc.page.height - 80;

  drawSeparator(doc, footerY - 10);

  doc.font('Helvetica-Bold').fontSize(FONT_SIZES.body).fillColor(COLORS.header);
  doc.text('Thank you for your business!', margin, footerY, { width: contentWidth, align: 'center' });

  doc.font('Helvetica').fontSize(FONT_SIZES.footer).fillColor(COLORS.secondary);
  const contactLine = workspace
    ? `${workspace.name}${workspace.phone ? ` | ${workspace.phone}` : ''}${workspace.website ? ` | ${workspace.website}` : ''}`
    : 'Neighborly';
  doc.text(contactLine, margin, footerY + 16, { width: contentWidth, align: 'center' });

  // Page numbers
  const totalPages = doc.bufferedPageRange()?.count ?? 1;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(FONT_SIZES.footer).fillColor(COLORS.secondary);
    doc.text(`Page ${i + 1} of ${totalPages}`, margin, doc.page.height - 40, {
      width: contentWidth,
      align: 'center',
    });
  }

  // Finalize
  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on('error', reject);
  });
}
