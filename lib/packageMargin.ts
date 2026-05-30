/**
 * Server-side BOM cost / margin math for provider packages (Sprint G).
 * Not persisted; recompute on every read from snapshot lines.
 */

export interface PackageMargin {
  /** Package selling currency */
  currency: string;
  /** Sum of qty × snapshotUnitPrice for lines whose snapshot currency matches the package */
  bomCost: number;
  /** Count of BOM lines whose snapshot currency differs from the package (excluded from bomCost) */
  crossCurrencyLines: number;
  /** package.finalPrice − bomCost */
  margin: number;
  /** (margin / finalPrice) × 100, or 0 when finalPrice === 0 */
  marginPercent: number;
}

export function computePackageMargin(
  pkg: { finalPrice: number; currency: string },
  bom: Array<{ quantity: number; snapshotUnitPrice: number; snapshotCurrency: string }>,
): PackageMargin {
  const currency = pkg.currency;
  let bomCost = 0;
  let crossCurrencyLines = 0;
  for (const line of bom) {
    if (line.snapshotCurrency === currency) {
      bomCost += line.quantity * line.snapshotUnitPrice;
    } else {
      crossCurrencyLines += 1;
    }
  }
  const margin = pkg.finalPrice - bomCost;
  const marginPercent =
    pkg.finalPrice === 0 ? 0 : (margin / pkg.finalPrice) * 100;
  return {
    currency,
    bomCost,
    crossCurrencyLines,
    margin,
    marginPercent,
  };
}
