/**
 * lib/orderBom.test.ts — Tests for G8 Inventory-Linked Service BOM
 *
 * Tests deductBomInventory and restoreBomInventory using mocked Prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Prisma ────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();

vi.mock('../lib/db.js', () => ({
  default: {
    order: {
      findUnique: mockFindUnique,
    },
    product: {
      update: mockUpdate,
    },
    $transaction: mockTransaction,
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a mock order with a matched package containing BOM items.
 */
function makeOrderWithBom(
  bomItems: Array<{
    productId: string;
    quantity: number;
    product: { id: string; name: string; stockQuantity: number | null };
  }>,
) {
  return {
    id: 'order-1',
    matchedPackageId: 'pkg-1',
    matchedPackage: {
      id: 'pkg-1',
      bom: bomItems,
    },
  };
}

/**
 * Build a mock order with no matched package (no BOM).
 */
function makeOrderWithoutPackage() {
  return {
    id: 'order-2',
    matchedPackageId: null,
    matchedPackage: null,
  };
}

/**
 * Build a mock order with a matched package but no BOM items.
 */
function makeOrderWithEmptyBom() {
  return {
    id: 'order-3',
    matchedPackageId: 'pkg-2',
    matchedPackage: {
      id: 'pkg-2',
      bom: [],
    },
  };
}

// ─── Tests: deductBomInventory ──────────────────────────────────────────────

describe('deductBomInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips deduction when order has no matched package', async () => {
    mockFindUnique.mockResolvedValue(makeOrderWithoutPackage());

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-2');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('skips deduction when order has no BOM items', async () => {
    mockFindUnique.mockResolvedValue(makeOrderWithEmptyBom());

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-3');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('deducts inventory for each BOM item', async () => {
    const bomItems = [
      {
        productId: 'prod-1',
        quantity: 2,
        product: { id: 'prod-1', name: 'Paint Bucket', stockQuantity: 10 },
      },
      {
        productId: 'prod-2',
        quantity: 1,
        product: { id: 'prod-2', name: 'Brush Set', stockQuantity: 5 },
      },
    ];
    mockFindUnique.mockResolvedValue(makeOrderWithBom(bomItems));

    // Each $transaction callback receives a tx object with product.findUnique and product.update
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      const tx = {
        product: {
          findUnique: vi.fn((args: { where: { id: string } }) => {
            const item = bomItems.find((b) => b.productId === args.where.id);
            return item?.product ?? null;
          }),
          update: vi.fn(),
        },
      };
      await cb(tx);
    });

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-1');

    expect(result.processed).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it('handles insufficient inventory gracefully', async () => {
    const bomItems = [
      {
        productId: 'prod-1',
        quantity: 99,
        product: { id: 'prod-1', name: 'Paint Bucket', stockQuantity: 10 },
      },
    ];
    mockFindUnique.mockResolvedValue(makeOrderWithBom(bomItems));

    // Simulate a transaction that throws because stock is insufficient
    mockTransaction.mockImplementation(async (_cb: unknown) => {
      throw new Error('Insufficient stock for Paint Bucket: have 10, need 99');
    });

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-1');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].productId).toBe('prod-1');
    expect(result.errors[0].name).toBe('Paint Bucket');
    expect(result.errors[0].error).toContain('Insufficient stock');
  });

  it('handles missing product gracefully', async () => {
    const bomItems = [
      {
        productId: 'prod-missing',
        quantity: 1,
        product: { id: 'prod-missing', name: 'Missing Item', stockQuantity: null },
      },
    ];
    mockFindUnique.mockResolvedValue(makeOrderWithBom(bomItems));

    // Simulate a transaction that throws because product is not found
    mockTransaction.mockImplementation(async (_cb: unknown) => {
      throw new Error('Product prod-missing not found');
    });

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-1');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('not found');
  });

  it('returns error when order fetch fails', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB connection failed'));

    const { deductBomInventory } = await import('./orderBom.js');
    const result = await deductBomInventory('order-1');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('DB connection failed');
  });
});

// ─── Tests: restoreBomInventory ─────────────────────────────────────────────

describe('restoreBomInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips restoration when order has no matched package', async () => {
    mockFindUnique.mockResolvedValue(makeOrderWithoutPackage());

    const { restoreBomInventory } = await import('./orderBom.js');
    const result = await restoreBomInventory('order-2');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('restores inventory for each BOM item', async () => {
    const bomItems = [
      {
        productId: 'prod-1',
        quantity: 2,
        product: { id: 'prod-1', name: 'Paint Bucket', stockQuantity: 8 },
      },
      {
        productId: 'prod-2',
        quantity: 1,
        product: { id: 'prod-2', name: 'Brush Set', stockQuantity: 4 },
      },
    ];
    mockFindUnique.mockResolvedValue(makeOrderWithBom(bomItems));
    mockUpdate.mockResolvedValue({});

    const { restoreBomInventory } = await import('./orderBom.js');
    const result = await restoreBomInventory('order-1');

    expect(result.processed).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { stockQuantity: { increment: 2 } },
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'prod-2' },
      data: { stockQuantity: { increment: 1 } },
    });
  });

  it('handles update failure gracefully', async () => {
    const bomItems = [
      {
        productId: 'prod-1',
        quantity: 2,
        product: { id: 'prod-1', name: 'Paint Bucket', stockQuantity: 8 },
      },
    ];
    mockFindUnique.mockResolvedValue(makeOrderWithBom(bomItems));
    mockUpdate.mockRejectedValue(new Error('Update failed'));

    const { restoreBomInventory } = await import('./orderBom.js');
    const result = await restoreBomInventory('order-1');

    expect(result.processed).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain('Update failed');
  });
});
