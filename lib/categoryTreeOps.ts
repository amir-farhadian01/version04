import prisma from './db.js';

/** Root depth = 0. Five category levels = depths 0..4 inclusive. */
export const MAX_CATEGORY_DEPTH = 4;

/**
 * Number of steps from the root. Root (no parent) has depth 0.
 */
export async function computeDepth(categoryId: string): Promise<number> {
  let d = 0;
  let id: string | null = categoryId;
  const seen = new Set<string>();
  for (;;) {
    if (!id) return d;
    if (seen.has(id)) return 999;
    seen.add(id);
    const c = await prisma.category.findUnique({ where: { id }, select: { parentId: true } });
    if (!c) return d;
    if (c.parentId == null) return d;
    d += 1;
    id = c.parentId;
  }
}

/**
 * Longest path from `categoryId` down to a descendant **category** (edge count; leaf = 0).
 */
export async function subtreeCategoryHeight(categoryId: string): Promise<number> {
  const kids = await prisma.category.findMany({ where: { parentId: categoryId }, select: { id: true } });
  if (kids.length === 0) return 0;
  const depths = await Promise.all(kids.map((k) => subtreeCategoryHeight(k.id)));
  return 1 + Math.max(0, ...depths);
}

/**
 * If `categoryId` is reparented under `newParentId` (null = root), the deepest result depth would
 * be `newDepth + subtreeHeight` which must be <= MAX_CATEGORY_DEPTH.
 */
export async function willExceedDepth(
  categoryId: string,
  newParentId: string | null
): Promise<boolean> {
  const newBaseDepth = newParentId == null ? 0 : (await computeDepth(newParentId)) + 1;
  const h = await subtreeCategoryHeight(categoryId);
  return newBaseDepth + h > MAX_CATEGORY_DEPTH;
}

/**
 * true if newParent is `categoryId` or an ancestor of it (reparenting would form a loop).
 */
export async function detectCycle(categoryId: string, newParentId: string | null): Promise<boolean> {
  if (newParentId == null) return false;
  if (newParentId === categoryId) return true;
  let p: string | null = newParentId;
  const seen = new Set<string>();
  while (p) {
    if (p === categoryId) return true;
    if (seen.has(p)) return true;
    seen.add(p);
    const row = await prisma.category.findUnique({ where: { id: p }, select: { parentId: true } });
    p = row?.parentId ?? null;
  }
  return false;
}

type Kind = 'category' | 'service';

/**
 * Reassign sortOrder 0..n-1 in one transaction, in the order of `orderedIds` (siblings of parentId).
 */
export async function resequenceSiblings(
  parentId: string | null,
  kind: Kind,
  orderedIds: string[]
): Promise<void> {
  if (kind === 'category') {
    await prisma.$transaction(
      orderedIds.map((id, i) =>
        prisma.category.update({
          where: { id },
          data: { sortOrder: i },
        })
      )
    );
    return;
  }
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.serviceCatalog.update({
        where: { id },
        data: { sortOrder: i },
      })
    )
  );
}
