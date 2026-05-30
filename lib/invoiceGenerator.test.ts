import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inflateSync } from 'node:zlib';

/**
 * Decode a PDF hex string (e.g., <48656c6c6f> → "Hello").
 */
function decodePdfHex(hex: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.substring(i, i + 2), 16);
    if (!isNaN(byte)) bytes.push(byte);
  }
  return Buffer.from(bytes).toString('utf-8');
}

/**
 * Extract text from a PDF buffer by decompressing FlateDecode streams.
 * Handles both (text) Tj and hex <hex> TJ operators.
 */
function extractPdfText(pdfBuffer: Buffer): string {
  const raw = pdfBuffer.toString('latin1');
  const results: string[] = [];

  // Extract text from uncompressed PDF metadata (info dict)
  const infoMatches = raw.match(/\(([^)]{2,})\)/g);
  if (infoMatches) {
    for (const m of infoMatches) {
      const text = m.slice(1, -1);
      if (/^[\x20-\x7E\s]+$/.test(text) && text.length > 1) {
        results.push(text);
      }
    }
  }

  // Decompress FlateDecode streams and extract text
  const streamRegex = /stream\s(.+?)\n?endstream/gs;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRegex.exec(raw)) !== null) {
    try {
      const rawBytes = Buffer.from(streamMatch[1].trim(), 'binary');
      const decompressed = inflateSync(rawBytes);
      const decoded = decompressed.toString('latin1');

      // Extract text from (text) Tj operators
      const tjMatches = decoded.match(/\(([^)]*)\)\s*Tj/g);
      if (tjMatches) {
        for (const tj of tjMatches) {
          const text = tj.match(/\(([^)]*)\)/)?.[1] ?? '';
          if (text) results.push(text);
        }
      }

      // Extract text from hex <hex> TJ arrays
      const tjArrayMatches = decoded.match(/\[([^\]]+)\]\s*TJ/g);
      if (tjArrayMatches) {
        for (const tj of tjArrayMatches) {
          const hexMatches = tj.match(/<([0-9A-Fa-f]+)>/g);
          if (hexMatches) {
            let line = '';
            for (const h of hexMatches) {
              const hex = h.slice(1, -1);
              line += decodePdfHex(hex);
            }
            if (line.trim()) results.push(line);
          }
        }
      }
    } catch {
      // Skip streams that can't be decompressed
    }
  }

  return results.join('\n');
}

// ---------------------------------------------------------------------------
// Mock Prisma before importing the module under test
// ---------------------------------------------------------------------------

const mockFindUnique = vi.hoisted(() => vi.fn());

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      findUnique: mockFindUnique,
    },
  },
}));

import { generateInvoicePdf, formatCents, getInvoiceFilename } from './invoiceGenerator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildMockOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'cm7abc123def456',
    description: 'Fix leaking faucet in kitchen',
    customer: {
      id: 'user_cust_1',
      displayName: 'John Doe',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      address: '123 Main St, Toronto, ON',
      phone: '+1-416-555-0100',
    },
    matchedProvider: {
      id: 'user_prov_1',
      displayName: 'Alice Plumber',
      email: 'alice@plumbing.co',
      phone: '+1-416-555-0200',
    },
    matchedWorkspace: {
      id: 'ws_1',
      name: 'Alice Plumbing Inc.',
      logoUrl: null,
      address: '456 Elms St, Toronto, ON',
      phone: '+1-416-555-0300',
      website: 'https://aliceplumbing.example.com',
      licenseNumber: 'LIC-12345',
    },
    serviceCatalog: {
      id: 'svc_1',
      name: 'Plumbing Repair',
      category: 'HOME_SERVICES',
      description: 'General plumbing repair services',
    },
    matchedPackage: {
      id: 'pkg_1',
      name: 'Standard Plumbing',
      finalPrice: 15000,
      currency: 'CAD',
    },
    payment: {
      id: 'pay_1',
      orderId: 'cm7abc123def456',
      amount: 15000,
      commission: 2250,
      deduction: 12750,
      status: 'CAPTURED',
      stripePaymentIntentId: null,
      stripeTransferId: null,
      escrowReleaseAt: new Date('2026-07-01'),
      createdAt: new Date('2026-05-26'),
      updatedAt: new Date('2026-05-26'),
    },
    invoice: null,
    jobRecord: {
      id: 'jr_1',
      orderId: 'cm7abc123def456',
      status: 'completed',
      completedAt: new Date('2026-05-26'),
      scheduledStartAt: new Date('2026-05-25'),
      actualStartAt: new Date('2026-05-25'),
      cancelledAt: null,
      cancelReason: null,
      providerNotes: null,
      completionPhotos: null,
      responseTimeMinutes: null,
      priceDelta: null,
      customerRating: null,
      createdAt: new Date('2026-05-24'),
      updatedAt: new Date('2026-05-26'),
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('formatCents', () => {
  it('formats whole dollars correctly', () => {
    expect(formatCents(150000)).toBe('$1,500.00');
  });

  it('formats cents with fractional dollars', () => {
    expect(formatCents(15050)).toBe('$150.50');
  });

  it('formats zero as $0.00', () => {
    expect(formatCents(0)).toBe('$0.00');
  });

  it('formats small amounts correctly', () => {
    expect(formatCents(99)).toBe('$0.99');
  });
});

describe('getInvoiceFilename', () => {
  it('returns correct filename from order ID', () => {
    expect(getInvoiceFilename('cm7abc123def456')).toBe('invoice-cm7abc12.pdf');
  });

  it('handles short order IDs', () => {
    expect(getInvoiceFilename('ab')).toBe('invoice-ab.pdf');
  });
});

describe('generateInvoicePdf', () => {
  it('throws error for non-existent order', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(generateInvoicePdf('nonexistent')).rejects.toThrow('Order not found');
  });

  it('throws error for order without payment', async () => {
    const orderWithoutPayment = buildMockOrder({ payment: null });
    mockFindUnique.mockResolvedValue(orderWithoutPayment);

    await expect(generateInvoicePdf('order_no_pay')).rejects.toThrow('Order has no payment record');
  });

  it('generates a PDF buffer successfully for a valid order', async () => {
    const mockOrder = buildMockOrder();
    mockFindUnique.mockResolvedValue(mockOrder);

    const buffer = await generateInvoicePdf('cm7abc123def456');

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('PDF buffer starts with %PDF magic bytes', async () => {
    const mockOrder = buildMockOrder();
    mockFindUnique.mockResolvedValue(mockOrder);

    const buffer = await generateInvoicePdf('cm7abc123def456');

    // PDF files start with "%PDF-"
    const header = buffer.subarray(0, 8).toString('utf-8');
    expect(header).toMatch(/^%PDF-/);
  });

  it('PDF contains expected text content (INVOICE, provider name)', async () => {
    const mockOrder = buildMockOrder();
    mockFindUnique.mockResolvedValue(mockOrder);

    const buffer = await generateInvoicePdf('cm7abc123def456');

    const text = extractPdfText(buffer);

    expect(text).toContain('INVOICE');
    expect(text).toContain('Alice Plumbing Inc.');
    expect(text).toContain('John Doe');
    expect(text).toContain('INV-CM7ABC12');
    expect(text).toContain(formatCents(15000));
  });

  it('generates PDF with commission row when commission > 0', async () => {
    const mockOrder = buildMockOrder();
    mockFindUnique.mockResolvedValue(mockOrder);

    const buffer = await generateInvoicePdf('cm7abc123def456');
    const text = extractPdfText(buffer);

    expect(text).toContain('Platform Fee');
    expect(text).toContain(formatCents(2250));
  });

  it('generates PDF without commission row when commission is 0', async () => {
    const mockOrder = buildMockOrder({
      payment: {
        ...buildMockOrder().payment,
        commission: 0,
        deduction: 15000,
      },
    });
    mockFindUnique.mockResolvedValue(mockOrder);

    const buffer = await generateInvoicePdf('cm7abc123def456');
    const content = buffer.toString('utf-8');

    expect(content).not.toContain('Platform Fee');
  });
});
