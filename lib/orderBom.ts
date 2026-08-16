/**
 * lib/orderBom.ts — Inventory-linked Service BOM (G8)
 *
 * Deducts / restores product stock quantities when an order transitions
 * to in_progress or is cancelled.
 *
 * Products store their current stock in `Product.stockQuantity`.
 * BOM lines are stored in `ProductInPackage` (aliased as `bomItems` on
 * ProviderServicePackage).
 */

import prisma from './db.js';

export interface BomDeductionResult {
  /** Number of BOM lines successfully deducted / restored */
  processed: number;
  /** Per-line errors (insufficient stock, missing product, etc.) */
  errors: { productId: string; name: string; error: string }[];
}

/**
 * Deduct stock quantities for all BOM items linked to an order's
 * matched service package.
 *
 * Each deduction runs inside its own Prisma transaction so that a
 * single failing line does not roll back previously succeeded lines.
 */
export async function deductBomInventory(orderId: string): Promise<BomDeductionResult> {
  const result: BomDeductionResult = { processed: 0, errors: [] };

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        matchedPackageId: true,
        matchedPackage: {
          include: {
            bom: {
              include: { product: true },
            },
          },
        },
      },
    });

    const bomItems = order?.matchedPackage?.bom;
    if (!bomItems || bomItems.length === 0) {
      return result; // No BOM items to deduct
    }

    for (const bomItem of bomItems) {
      try {
        await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id: bomItem.productId },
            select: { id: true, name: true, stockQuantity: true },
          });

          if (!product) {
            throw new Error(`Product ${bomItem.productId} not found`);
          }

          const currentStock = product.stockQuantity ?? 0;
          if (currentStock < bomItem.quantity) {
            throw new Error(
              `Insufficient stock for ${product.name}: ` +
                `have ${currentStock}, need ${bomItem.quantity}`,
            );
          }

          await tx.product.update({
            where: { id: bomItem.productId },
            data: { stockQuantity: { decrement: bomItem.quantity } },
          });
        });

        result.processed++;
      } catch (err) {
        result.errors.push({
          productId: bomItem.productId,
          name: bomItem.product.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } catch (err) {
    console.error(`[OrderBom] Error fetching order ${orderId}:`, err);
    result.errors.push({
      productId: 'N/A',
      name: 'Order Fetch',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  return result;
}

/**
 * Restore stock quantities for all BOM items linked to an order's
 * matched service package.
 *
 * Called when an order is cancelled to return inventory.
 */
export async function restoreBomInventory(orderId: string): Promise<BomDeductionResult> {
  const result: BomDeductionResult = { processed: 0, errors: [] };

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        matchedPackageId: true,
        matchedPackage: {
          include: {
            bom: {
              include: { product: true },
            },
          },
        },
      },
    });

    const bomItems = order?.matchedPackage?.bom;
    if (!bomItems || bomItems.length === 0) {
      return result; // No BOM items to restore
    }

    for (const bomItem of bomItems) {
      try {
        await prisma.product.update({
          where: { id: bomItem.productId },
          data: { stockQuantity: { increment: bomItem.quantity } },
        });
        result.processed++;
      } catch (err) {
        result.errors.push({
          productId: bomItem.productId,
          name: bomItem.product.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  } catch (err) {
    console.error(`[OrderBom] Error restoring inventory for order ${orderId}:`, err);
    result.errors.push({
      productId: 'N/A',
      name: 'Order Fetch',
      error: err instanceof Error ? err.message : 'Unknown error',
    });
  }

  return result;
}
