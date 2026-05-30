import type { Prisma } from '@prisma/client';
import { OrderPhase, OrderStatus } from '@prisma/client';
import type { Request } from 'express';
import prisma from './db.js';
import { categoryBreadcrumbs } from './categoryBreadcrumbs.js';
import { phaseListWhere } from './orderPhase.js';
import { countOrderPhaseFacets, type OrderPhaseFacetCounts } from './orderPhaseFacets.js';

const VALID_SORT = ['createdAt', 'submittedAt', 'scheduledAt', 'status', 'updatedAt'] as const;
type SortKey = (typeof VALID_SORT)[number];

const DEFAULT_PHASES: OrderPhase[] = [OrderPhase.offer, OrderPhase.order, OrderPhase.job];

export type AdminOrderListItem = {
  id: string;
  status: string;
  phase: OrderPhase | null;
  entryPoint: string;
  scheduledAt: string | null;
  address: string;
  addressTruncated: string;
  photoCount: number;
  answersFieldCount: number;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  matchedProviderName: string | null;
  matchedWorkspaceName: string | null;
  customer: {
    id: string;
    displayName: string | null;
    email: string;
    avatarUrl: string | null;
  };
  serviceCatalog: {
    id: string;
    name: string;
    breadcrumb: Awaited<ReturnType<typeof categoryBreadcrumbs>>;
  };
};

export type AdminOrdersListResponse = {
  items: AdminOrderListItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    status: Record<string, number>;
    entryPoint: Record<string, number>;
    serviceCatalog: Array<{ id: string; name: string; count: number }>;
    phase: OrderPhaseFacetCounts;
  };
};

type BuildOpts = {
  q?: string;
  status: string[];
  /** Free-text substring filter against `OrderStatus` enum values (query param `search`). */
  statusSearch?: string;
  entryPoint: string[];
  serviceCatalogId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  phases: OrderPhase[];
  includeDrafts: boolean;
  /** When set, only orders where the user is the customer or matched provider (CRM deep-link). */
  userId?: string;
};

type DropDim = 'none' | 'status' | 'entryPoint' | 'serviceCatalog' | 'phase';

function pickStr(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return undefined;
}

function pickQueryStr(q: Request['query'], key: string): string | undefined {
  const v = q[key];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string' && v[0].trim()) return v[0].trim();
  return undefined;
}

function toStrArray(x: unknown): string[] {
  if (x == null) return [];
  if (Array.isArray(x)) return x.filter((a): a is string => typeof a === 'string' && a.length > 0);
  if (typeof x === 'string' && x.length) return [x];
  return [];
}

function parseIntDefault(s: string | undefined, def: number, min: number, max: number): number {
  const n = s != null && s !== '' ? Number.parseInt(s, 10) : def;
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

function parseDate(v: string | undefined): Date | undefined {
  if (!v || !String(v).trim()) return undefined;
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) return undefined;
  return new Date(t);
}

const ORDER_STATUSES = new Set([
  'draft',
  'submitted',
  'cancelled',
  'matching',
  'matched',
  'contracted',
  'paid',
  'in_progress',
  'completed',
  'closed',
]);
const ENTRY_POINTS = new Set(['explorer', 'ai_suggestion', 'direct']);
const ORDER_PHASES = new Set<string>(['offer', 'order', 'job']);

/** `null` = no filter; `[]` = no status matches substring (impossible). */
function statusesMatchingSubstring(raw: string | undefined): OrderStatus[] | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().toLowerCase();
  const out = [...ORDER_STATUSES].filter((s) => s.toLowerCase().includes(t)) as OrderStatus[];
  return out.length ? out : [];
}

export function buildAdminOrderListOpts(q: Request['query']): BuildOpts {
  const status = [
    ...toStrArray((q as Record<string, unknown>)['status']),
    ...toStrArray((q as Record<string, unknown>)['status[]']),
  ].filter((s) => ORDER_STATUSES.has(s));
  const entryPoint = [
    ...toStrArray((q as Record<string, unknown>)['entryPoint']),
    ...toStrArray((q as Record<string, unknown>)['entryPoint[]']),
  ].filter((s) => ENTRY_POINTS.has(s));
  const phaseRaw = [
    ...toStrArray((q as Record<string, unknown>)['phase']),
    ...toStrArray((q as Record<string, unknown>)['phase[]']),
  ].filter((s) => ORDER_PHASES.has(s));
  const phases = phaseRaw.map((p) => p as OrderPhase);
  const userId = pickQueryStr(q, 'userId')?.trim();
  return {
    q: pickStr(q.q),
    status,
    statusSearch: pickQueryStr(q, 'search'),
    entryPoint,
    serviceCatalogId: pickStr(q.serviceCatalogId),
    createdFrom: parseDate(pickQueryStr(q, 'createdFrom')),
    createdTo: parseDate(pickQueryStr(q, 'createdTo')),
    scheduledFrom: parseDate(pickQueryStr(q, 'scheduledFrom')),
    scheduledTo: parseDate(pickQueryStr(q, 'scheduledTo')),
    phases,
    includeDrafts: pickQueryStr(q, 'includeDrafts') === 'true',
    userId: userId && userId.length > 0 ? userId : undefined,
  };
}

export function buildOrderWhere(o: BuildOpts, drop: DropDim = 'none'): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [];
  if (o.userId?.trim()) {
    const uid = o.userId.trim();
    and.push({
      OR: [{ customerId: uid }, { matchedProviderId: uid }],
    });
  }
  if (o.q?.trim()) {
    const t = o.q.trim();
    and.push({
      OR: [
        { address: { contains: t, mode: 'insensitive' } },
        { description: { contains: t, mode: 'insensitive' } },
        { customer: { email: { contains: t, mode: 'insensitive' } } },
        { customer: { displayName: { contains: t, mode: 'insensitive' } } },
      ],
    });
  }
  const searchHits = statusesMatchingSubstring(o.statusSearch);
  if (searchHits !== null && searchHits.length === 0) {
    return { id: { in: [] } };
  }
  if (drop !== 'status') {
    let statusIn: OrderStatus[] | null = null;
    const seg = o.status as OrderStatus[];
    if (searchHits) {
      if (seg.length) {
        const inter = seg.filter((s) => searchHits.includes(s));
        if (!inter.length) return { id: { in: [] } };
        statusIn = inter;
      } else {
        statusIn = searchHits;
      }
    } else if (seg.length) {
      statusIn = seg;
    }
    if (statusIn?.length) {
      and.push({ status: { in: statusIn as Prisma.EnumOrderStatusFilter['in'] } });
    }
  } else if (searchHits?.length) {
    and.push({ status: { in: searchHits as Prisma.EnumOrderStatusFilter['in'] } });
  }
  if (drop !== 'entryPoint' && o.entryPoint.length) {
    and.push({ entryPoint: { in: o.entryPoint as Prisma.EnumOrderEntryPointFilter['in'] } });
  }
  if (drop !== 'serviceCatalog' && o.serviceCatalogId) {
    and.push({ serviceCatalogId: o.serviceCatalogId });
  }
  if (o.createdFrom || o.createdTo) {
    and.push({
      createdAt: {
        ...(o.createdFrom ? { gte: o.createdFrom } : {}),
        ...(o.createdTo ? { lte: o.createdTo } : {}),
      },
    });
  }
  if (o.scheduledFrom || o.scheduledTo) {
    and.push({
      scheduledAt: {
        ...(o.scheduledFrom ? { gte: o.scheduledFrom } : {}),
        ...(o.scheduledTo ? { lte: o.scheduledTo } : {}),
      },
    });
  }
  if (drop !== 'phase') {
    const ph = o.phases.length ? o.phases : DEFAULT_PHASES;
    and.push(phaseListWhere(ph, o.includeDrafts));
  }
  if (!and.length) return {};
  if (and.length === 1) return and[0]!;
  return { AND: and };
}

function sortOrder(sortBy: SortKey, sortDir: 'asc' | 'desc'): Prisma.OrderOrderByWithRelationInput {
  const d = sortDir;
  const map: Record<SortKey, Prisma.OrderOrderByWithRelationInput> = {
    createdAt: { createdAt: d },
    submittedAt: { submittedAt: d },
    scheduledAt: { scheduledAt: d },
    status: { status: d },
    updatedAt: { updatedAt: d },
  };
  return map[sortBy];
}

function truncateAddress(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 3)}...`;
}

function countsFromJson(answers: unknown, photos: unknown): {
  answersFieldCount: number;
  photoCount: number;
} {
  let answersFieldCount = 0;
  if (answers && typeof answers === 'object' && !Array.isArray(answers)) {
    answersFieldCount = Object.keys(answers as object).length;
  }
  const photoCount = Array.isArray(photos) ? photos.length : 0;
  return { answersFieldCount, photoCount };
}

function groupByToRecord(
  rows: Array<{ [k: string]: unknown; _count: { _all: number } }>,
  key: string,
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of rows) {
    const k = r[key];
    const label = k == null || k === '' ? '(none)' : String(k);
    o[label] = (o[label] ?? 0) + r._count._all;
  }
  return o;
}

export async function getAdminOrdersList(req: Request): Promise<{
  status: number;
  body: AdminOrdersListResponse | { error: string };
}> {
  const q = req.query;
  const sortBy = pickStr(q.sortBy) as SortKey | undefined;
  if (sortBy && !VALID_SORT.includes(sortBy as SortKey)) {
    return {
      status: 400,
      body: { error: `Invalid sortBy. Expected one of: ${VALID_SORT.join(', ')}` },
    };
  }
  const sKey: SortKey = (sortBy ?? 'createdAt') as SortKey;
  const sortDir: 'asc' | 'desc' = pickStr(q.sortDir) === 'asc' ? 'asc' : 'desc';
  const page = parseIntDefault(pickQueryStr(q, 'page'), 1, 1, 1_000_000);
  const pageSize = parseIntDefault(pickQueryStr(q, 'pageSize'), 25, 1, 200);
  const opts = buildAdminOrderListOpts(q);
  const where = buildOrderWhere(opts, 'none');
  const skip = (page - 1) * pageSize;

  const whereStatusFacet = buildOrderWhere(opts, 'status');
  const whereEntryFacet = buildOrderWhere(opts, 'entryPoint');
  const whereCatFacet = buildOrderWhere(opts, 'serviceCatalog');
  const wherePhaseFacet = buildOrderWhere(opts, 'phase');

  const [total, rows, statusGroups, entryGroups, catGroups, phaseFacet] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        customer: {
          select: { id: true, displayName: true, email: true, avatarUrl: true },
        },
        serviceCatalog: { select: { id: true, name: true, categoryId: true } },
        matchedProvider: { select: { displayName: true, firstName: true, lastName: true } },
        matchedWorkspace: { select: { name: true } },
      },
      orderBy: sortOrder(sKey, sortDir),
      skip,
      take: pageSize,
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: whereStatusFacet,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['entryPoint'],
      where: whereEntryFacet,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['serviceCatalogId'],
      where: whereCatFacet,
      _count: { _all: true },
    }),
    countOrderPhaseFacets(wherePhaseFacet),
  ]);

  const catSorted = [...catGroups].sort((a, b) => b._count._all - a._count._all).slice(0, 20);
  const catIds = catSorted.map((c) => c.serviceCatalogId);
  const catalogs = await prisma.serviceCatalog.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(catalogs.map((c) => [c.id, c.name] as const));

  const facetCatalog = catSorted.map((c) => ({
    id: c.serviceCatalogId,
    name: nameById.get(c.serviceCatalogId) ?? c.serviceCatalogId,
    count: c._count._all,
  }));

  const uniqueCategoryIds = [...new Set(rows.map((r) => r.serviceCatalog.categoryId).filter(Boolean))] as string[];
  const crumbCache = new Map<string, Awaited<ReturnType<typeof categoryBreadcrumbs>>>();
  await Promise.all(
    uniqueCategoryIds.map(async (cid) => {
      crumbCache.set(cid, await categoryBreadcrumbs(cid, 5));
    }),
  );

  const items: AdminOrderListItem[] = rows.map((r) => {
    const { answersFieldCount, photoCount } = countsFromJson(r.answers, r.photos);
    const cid = r.serviceCatalog.categoryId;
    const breadcrumb = cid ? crumbCache.get(cid) ?? [] : [];
    return {
      id: r.id,
      status: r.status,
      phase: r.phase,
      entryPoint: r.entryPoint,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      address: r.address,
      addressTruncated: truncateAddress(r.address, 80),
      photoCount,
      answersFieldCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      cancelledAt: r.cancelledAt ? r.cancelledAt.toISOString() : null,
      cancelReason: r.cancelReason,
      matchedProviderName:
        [r.matchedProvider?.firstName, r.matchedProvider?.lastName].filter(Boolean).join(' ') ||
        r.matchedProvider?.displayName ||
        null,
      matchedWorkspaceName: r.matchedWorkspace?.name ?? null,
      customer: r.customer,
      serviceCatalog: {
        id: r.serviceCatalog.id,
        name: r.serviceCatalog.name,
        breadcrumb,
      },
    };
  });

  const body: AdminOrdersListResponse = {
    items,
    total,
    page,
    pageSize,
    facets: {
      status: groupByToRecord(statusGroups as never, 'status'),
      entryPoint: groupByToRecord(entryGroups as never, 'entryPoint'),
      serviceCatalog: facetCatalog,
      phase: phaseFacet,
    },
  };
  return { status: 200, body };
}
