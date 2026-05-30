import type { Prisma } from '@prisma/client';
import prisma from './db.js';
import { MAX_CATEGORY_DEPTH, computeDepth } from './categoryTreeOps.js';

export type ServiceCatalogLite = {
  id: string;
  name: string;
  slug: string | null;
  isActive: boolean;
  sortOrder: number;
  archivedAt: string | null;
  _count: { providerServices: number };
};

export type CategoryTreeItem = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  icon: string | null;
  description: string | null;
  depth: number;
  archivedAt: string | null;
  children: CategoryTreeItem[];
  services: ServiceCatalogLite[];
};

const catSelect = {
  id: true,
  name: true,
  parentId: true,
  sortOrder: true,
  icon: true,
  description: true,
  archivedAt: true,
} as const;

const scSelect = {
  id: true,
  name: true,
  slug: true,
  isActive: true,
  sortOrder: true,
  archivedAt: true,
  categoryId: true,
  _count: { select: { services: true } },
} as const;

type CatRow = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  icon: string | null;
  description: string | null;
  archivedAt: Date | null;
};

type ScRow = {
  id: string;
  name: string;
  slug: string | null;
  isActive: boolean;
  sortOrder: number;
  archivedAt: Date | null;
  categoryId: string | null;
  _count: { services: number };
};

function toLite(s: ScRow): ServiceCatalogLite {
  return {
    id: s.id,
    name: s.name,
    slug: s.slug,
    isActive: s.isActive,
    sortOrder: s.sortOrder,
    archivedAt: s.archivedAt ? s.archivedAt.toISOString() : null,
    _count: { providerServices: s._count.services },
  };
}

const sortCats = (a: CatRow, b: CatRow) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const sortSc = (a: ScRow, b: ScRow) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

function scWhere(
  includeArchived: boolean
): Prisma.ServiceCatalogWhereInput {
  if (includeArchived) return {};
  return { archivedAt: null };
}

function catWhere(
  includeArchived: boolean
): Prisma.CategoryWhereInput {
  if (includeArchived) return {};
  return { archivedAt: null };
}

function buildCategoryNode(
  row: CatRow,
  byParent: Map<string | null, CatRow[]>,
  servicesByCategory: Map<string, ScRow[]>,
  childCountByParent: Map<string, number>,
  depth: number
): CategoryTreeItem {
  const subcats = (byParent.get(row.id) ?? []).slice().sort(sortCats);
  const children: CategoryTreeItem[] = [];
  for (const ch of subcats) {
    if (depth + 1 > MAX_CATEGORY_DEPTH) {
      console.warn(`tree-depth-cap reached for ${ch.id}`);
      continue;
    }
    children.push(buildCategoryNode(ch, byParent, servicesByCategory, childCountByParent, depth + 1));
  }
  const nKids = childCountByParent.get(row.id) ?? 0;
  const isLeaf = nKids === 0;
  const scList = isLeaf
    ? (servicesByCategory.get(row.id) ?? []).slice().sort(sortSc).map(toLite)
    : [];
  return {
    id: row.id,
    name: row.name,
    parentId: row.parentId,
    sortOrder: row.sortOrder,
    icon: row.icon,
    description: row.description,
    depth,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    children,
    services: scList,
  };
}

/**
 * Public tree: roots + nested, services only on categories with no subcategories in DB.
 */
export async function getTreeWithServices(includeArchived: boolean): Promise<CategoryTreeItem[]> {
  const [allCats, allSc] = await Promise.all([
    prisma.category.findMany({
      where: catWhere(includeArchived),
      select: catSelect,
    }),
    prisma.serviceCatalog.findMany({
      where: scWhere(includeArchived),
      select: scSelect,
    }),
  ]);
  const catRows: CatRow[] = allCats.map((c) => ({
    ...c,
  }));
  const byParent = new Map<string | null, CatRow[]>();
  for (const c of catRows) {
    const k = c.parentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  const childCountByParent = new Map<string, number>();
  for (const c of catRows) {
    if (c.parentId) {
      childCountByParent.set(c.parentId, (childCountByParent.get(c.parentId) ?? 0) + 1);
    }
  }
  const servicesByCategory = new Map<string, ScRow[]>();
  for (const s of allSc) {
    if (s.categoryId) {
      if (!servicesByCategory.has(s.categoryId)) servicesByCategory.set(s.categoryId, []);
      servicesByCategory.get(s.categoryId)!.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
        archivedAt: s.archivedAt,
        categoryId: s.categoryId,
        _count: s._count,
      });
    }
  }
  const roots = (byParent.get(null) ?? []).slice().sort(sortCats);
  return roots.map((r) => buildCategoryNode(r, byParent, servicesByCategory, childCountByParent, 0));
}

/**
 * Single subtree (full) rooted at `rootId` (same service attach rules as full tree).
 */
export async function getSubtreeByCategoryId(
  rootId: string,
  includeArchived: boolean
): Promise<CategoryTreeItem | null> {
  const root = await prisma.category.findFirst({
    where: { id: rootId, ...catWhere(includeArchived) },
    select: catSelect,
  });
  if (!root) return null;
  const d0 = await computeDepth(rootId);
  const [allCats, allSc] = await Promise.all([
    prisma.category.findMany({
      where: catWhere(includeArchived),
      select: catSelect,
    }),
    prisma.serviceCatalog.findMany({
      where: scWhere(includeArchived),
      select: scSelect,
    }),
  ]);
  const catRows: CatRow[] = allCats.map((c) => ({ ...c }));
  const byParent = new Map<string | null, CatRow[]>();
  for (const c of catRows) {
    const k = c.parentId;
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k)!.push(c);
  }
  const childCountByParent = new Map<string, number>();
  for (const c of catRows) {
    if (c.parentId) {
      childCountByParent.set(c.parentId, (childCountByParent.get(c.parentId) ?? 0) + 1);
    }
  }
  const servicesByCategory = new Map<string, ScRow[]>();
  for (const s of allSc) {
    if (s.categoryId) {
      if (!servicesByCategory.has(s.categoryId)) servicesByCategory.set(s.categoryId, []);
      servicesByCategory.get(s.categoryId)!.push({
        id: s.id,
        name: s.name,
        slug: s.slug,
        isActive: s.isActive,
        sortOrder: s.sortOrder,
        archivedAt: s.archivedAt,
        categoryId: s.categoryId,
        _count: s._count,
      });
    }
  }
  return buildCategoryNode(
    {
      id: root.id,
      name: root.name,
      parentId: root.parentId,
      sortOrder: root.sortOrder,
      icon: root.icon,
      description: root.description,
      archivedAt: root.archivedAt,
    },
    byParent,
    servicesByCategory,
    childCountByParent,
    d0
  );
}
