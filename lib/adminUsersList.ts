import type { Prisma, Status, UserRole } from '@prisma/client';
import type { Request } from 'express';
import prisma from './db.js';
import {
  SEGMENT_ROLES,
  type AdminSegment,
  type AdminUserRow,
  type AdminUsersResponse,
} from './adminUsersTypes.js';

const VALID_SORT = [
  'createdAt',
  'lastLoginAt',
  'displayName',
  'email',
  'role',
  'status',
  'isVerified',
  'requestsAsCustomer',
  'requestsAsProvider',
  'contractsAsCustomer',
  'contractsAsProvider',
  'services',
] as const;
type SortKey = (typeof VALID_SORT)[number];

const KYC_STATUS = new Set(['pending', 'verified', 'rejected']);
const USER_ROLES: Set<string> = new Set([
  'owner',
  'platform_admin',
  'developer',
  'support',
  'finance',
  'customer',
  'provider',
  'staff',
]);
const USER_STATUSES: Set<Status> = new Set(['active', 'suspended', 'pending_verification']);

export const userListInclude = {
  kyc: true,
  ownedCompany: { select: { id: true, name: true, kycStatus: true } },
  companies: { include: { company: { select: { id: true, name: true } } } },
  _count: {
    select: {
      requestsAsCustomer: true,
      requestsAsProvider: true,
      contractsAsCustomer: true,
      contractsAsProvider: true,
      services: true,
    },
  },
} satisfies Prisma.UserInclude;

type UserListPayload = Prisma.UserGetPayload<{ include: typeof userListInclude }>;

function toIso(d: Date | null | undefined): string | null {
  return d == null ? null : d.toISOString();
}

function kycToRow(
  k: { type: string; status: string } | null
): { personalStatus: 'pending' | 'verified' | 'rejected' | null; businessStatus: 'pending' | 'verified' | 'rejected' | null } {
  if (!k) return { personalStatus: null, businessStatus: null };
  const s = (KYC_STATUS.has(k.status) ? k.status : 'pending') as 'pending' | 'verified' | 'rejected';
  if (k.type === 'personal') return { personalStatus: s, businessStatus: null };
  if (k.type === 'business') return { personalStatus: null, businessStatus: s };
  return { personalStatus: s, businessStatus: null };
}

export function mapUserToRow(u: UserListPayload): AdminUserRow {
  const c = u._count;
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
    staffRole: u.staffRole,
    status: u.status,
    isVerified: u.isVerified,
    mfaEnabled: u.mfaEnabled,
    gender: u.gender,
    address: u.address,
    location: u.location,
    bio: u.bio,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    lastLoginAt: toIso(u.lastLoginAt),
    lastSeenAt: toIso(u.lastSeenAt),
    lastDevice: u.lastDevice,
    lastIp: u.lastIp,
    registrationIp: u.registrationIp,
    birthDate: toIso(u.birthDate),
    kyc: kycToRow(u.kyc),
    ownedCompany: u.ownedCompany
      ? { id: u.ownedCompany.id, name: u.ownedCompany.name, kycStatus: u.ownedCompany.kycStatus }
      : null,
    memberships: u.companies.map((cu) => ({
      companyId: cu.companyId,
      companyName: cu.company.name,
      role: cu.role,
    })),
    counts: {
      requestsAsCustomer: c.requestsAsCustomer,
      requestsAsProvider: c.requestsAsProvider,
      contracts: c.contractsAsCustomer + c.contractsAsProvider,
      contractsAsCustomer: c.contractsAsCustomer,
      contractsAsProvider: c.contractsAsProvider,
      services: c.services,
    },
  };
}

function applyRowEnrichment(
  base: AdminUserRow,
  extras: {
    avgServiceRating: number | null;
    lastCustomerRequestAt: string | null;
    customerContractsValue: number | null;
  }
): AdminUserRow {
  return {
    ...base,
    avgServiceRating: extras.avgServiceRating,
    lastCustomerRequestAt: extras.lastCustomerRequestAt,
    customerContractsValue: extras.customerContractsValue,
    ownedCompanyKycStatus: base.ownedCompany?.kycStatus ?? null,
  };
}

async function enrichAdminRows(rows: UserListPayload[]): Promise<AdminUserRow[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [avgByProv, maxReqByCust, sumContByCust] = await Promise.all([
    prisma.service.groupBy({
      by: ['providerId'],
      where: { providerId: { in: ids } },
      _avg: { rating: true },
    }),
    prisma.request.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids } },
      _max: { createdAt: true },
    }),
    prisma.contract.groupBy({
      by: ['customerId'],
      where: { customerId: { in: ids } },
      _sum: { amount: true },
    }),
  ]);
  const avgM = new Map(avgByProv.map((a) => [a.providerId, a._avg.rating ?? null] as const));
  const maxM = new Map(
    maxReqByCust.map((a) => [a.customerId, a._max.createdAt] as const)
  );
  const sumM = new Map(
    sumContByCust.map((a) => [a.customerId, a._sum.amount ?? 0] as const)
  );
  return rows.map((r) => {
    const b = mapUserToRow(r);
    return applyRowEnrichment(b, {
      avgServiceRating: avgM.get(r.id) ?? null,
      lastCustomerRequestAt: maxM.get(r.id) ? (maxM.get(r.id) as Date).toISOString() : null,
      customerContractsValue: sumM.get(r.id) ?? null,
    });
  });
}

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

export type BuildWhereOptions = {
  q?: string;
  segment: AdminSegment;
  roles: string[];
  statuses: string[];
  isVerified?: boolean;
  kycStatus: string[];
  /** KYC `type=personal` status filters (incl. none). When non-empty, used instead of flat `kycStatus`. */
  kycPersonal: string[];
  kycBusiness: string[];
  genders: string[];
  companyId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  lastLoginFrom?: Date;
  lastLoginTo?: Date;
  phoneContains?: string;
  addressContains?: string;
  lastDeviceContains?: string;
  lastIpContains?: string;
  ownedCompanyNameContains?: string;
};

type DropDim = 'none' | 'roleAxis' | 'status' | 'kyc' | 'gender';

function kycAxisWhere(axis: 'personal' | 'business', values: string[]): Prisma.UserWhereInput | undefined {
  if (!values.length) return undefined;
  const other: 'personal' | 'business' = axis === 'personal' ? 'business' : 'personal';
  const parts: Prisma.UserWhereInput[] = [];
  for (const raw of values) {
    const v0 = String(raw).toLowerCase();
    if (v0 === 'none' || v0 === '(none)' || v0 === '__none__') {
      parts.push({ OR: [{ kyc: null }, { kyc: { is: { type: other } } }] });
    } else if (KYC_STATUS.has(v0)) {
      parts.push({ kyc: { is: { type: axis, status: v0 } } });
    }
  }
  if (!parts.length) return undefined;
  if (parts.length === 1) return parts[0]!;
  return { OR: parts };
}

function resolveRoleIn(
  o: BuildWhereOptions,
  dropSegment: boolean,
  dropRoleList: boolean
): { in: UserRole[] } | { impossible: true } | undefined {
  const seg: AdminSegment = dropSegment ? 'all' : o.segment;
  const segList = SEGMENT_ROLES[seg as keyof typeof SEGMENT_ROLES];
  const want = dropRoleList ? [] : o.roles;
  if (seg === 'all' || !segList) {
    if (!want.length) return undefined;
    const inList = want.filter((r) => USER_ROLES.has(r)) as UserRole[];
    return inList.length ? { in: inList } : { impossible: true };
  }
  const allow = new Set([...segList] as string[]);
  if (!want.length) return { in: [...allow].filter((r) => USER_ROLES.has(r)) as UserRole[] };
  const inter = want.filter((r) => allow.has(r) && USER_ROLES.has(r)) as UserRole[];
  return inter.length ? { in: inter } : { impossible: true };
}

export function buildUserWhere(
  o: BuildWhereOptions,
  drop: DropDim = 'none'
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];
  if (o.q) {
    const t = o.q.trim();
    and.push({
      OR: [
        { email: { contains: t, mode: 'insensitive' } },
        { displayName: { contains: t, mode: 'insensitive' } },
        { firstName: { contains: t, mode: 'insensitive' } },
        { lastName: { contains: t, mode: 'insensitive' } },
        { phone: { contains: t, mode: 'insensitive' } },
        { id: t },
      ],
    });
  }
  const r = resolveRoleIn(o, drop === 'roleAxis', drop === 'roleAxis');
  if (r && 'impossible' in r) and.push({ AND: [{ id: 'x' }, { id: 'y' }] });
  else if (r && 'in' in r && r.in.length) and.push({ role: { in: r.in } });
  if (drop !== 'status' && o.statuses.length) {
    const s = o.statuses.filter((x) => USER_STATUSES.has(x as Status)) as Status[];
    if (s.length) and.push({ status: { in: s } });
  }
  if (o.isVerified === true) and.push({ isVerified: true });
  if (o.isVerified === false) and.push({ isVerified: false });
  if (drop !== 'kyc') {
    if (o.kycPersonal.length || o.kycBusiness.length) {
      const pa = kycAxisWhere('personal', o.kycPersonal);
      const ba = kycAxisWhere('business', o.kycBusiness);
      if (pa) and.push(pa);
      if (ba) and.push(ba);
    } else if (o.kycStatus.length) {
      const hasNone = o.kycStatus.some((s) => s === '__none__' || s === '(none)' || s === 'none');
      const rest = o.kycStatus.filter(
        (s) => s !== '__none__' && s !== '(none)' && s !== 'none' && KYC_STATUS.has(s)
      );
      if (hasNone && !rest.length) and.push({ kyc: null });
      else if (!hasNone && rest.length) and.push({ kyc: { status: { in: rest } } });
      else if (hasNone && rest.length) and.push({ OR: [{ kyc: null }, { kyc: { status: { in: rest } } }] });
    }
  }
  if (drop !== 'gender' && o.genders.length) {
    and.push({ gender: { in: o.genders } });
  }
  if (o.companyId) {
    and.push({
      OR: [
        { companies: { some: { companyId: o.companyId } } },
        { ownedCompany: { is: { id: o.companyId } } },
        { companyId: o.companyId },
      ],
    });
  }
  if (o.createdFrom || o.createdTo) {
    and.push({
      createdAt: {
        ...(o.createdFrom ? { gte: o.createdFrom } : {}),
        ...(o.createdTo ? { lte: o.createdTo } : {}),
      },
    });
  }
  if (o.lastLoginFrom || o.lastLoginTo) {
    and.push({
      lastLoginAt: {
        ...(o.lastLoginFrom ? { gte: o.lastLoginFrom } : {}),
        ...(o.lastLoginTo ? { lte: o.lastLoginTo } : {}),
      },
    });
  }
  if (o.phoneContains?.trim()) {
    and.push({ phone: { contains: o.phoneContains.trim(), mode: 'insensitive' } });
  }
  if (o.addressContains?.trim()) {
    and.push({ address: { contains: o.addressContains.trim(), mode: 'insensitive' } });
  }
  if (o.lastDeviceContains?.trim()) {
    and.push({ lastDevice: { contains: o.lastDeviceContains.trim(), mode: 'insensitive' } });
  }
  if (o.ownedCompanyNameContains?.trim()) {
    const t = o.ownedCompanyNameContains.trim();
    and.push({
      OR: [
        { ownedCompany: { is: { name: { contains: t, mode: 'insensitive' } } } },
        { companies: { some: { company: { name: { contains: t, mode: 'insensitive' } } } } },
      ],
    });
  }
  if (o.lastIpContains?.trim()) {
    and.push({ lastIp: { contains: o.lastIpContains.trim(), mode: 'insensitive' } });
  }
  if (!and.length) return {};
  if (and.length === 1) return and[0]!;
  return { AND: and };
}

function sortOrder(sortBy: SortKey, sortDir: 'asc' | 'desc'): Prisma.UserOrderByWithRelationInput {
  const d = sortDir;
  if (sortBy === 'requestsAsCustomer') return { requestsAsCustomer: { _count: d } };
  if (sortBy === 'requestsAsProvider') return { requestsAsProvider: { _count: d } };
  if (sortBy === 'contractsAsCustomer') return { contractsAsCustomer: { _count: d } };
  if (sortBy === 'contractsAsProvider') return { contractsAsProvider: { _count: d } };
  if (sortBy === 'services') return { services: { _count: d } };
  const map: Record<
    Exclude<SortKey, 'requestsAsCustomer' | 'requestsAsProvider' | 'contractsAsCustomer' | 'contractsAsProvider' | 'services'>,
    Prisma.UserOrderByWithRelationInput
  > = {
    createdAt: { createdAt: d },
    lastLoginAt: { lastLoginAt: d },
    displayName: { displayName: d },
    email: { email: d },
    role: { role: d },
    status: { status: d },
    isVerified: { isVerified: d },
  };
  return map[sortBy as keyof typeof map];
}

function parseDate(v: string | undefined): Date | undefined {
  if (!v || !String(v).trim()) return undefined;
  const t = Date.parse(String(v));
  if (Number.isNaN(t)) return undefined;
  return new Date(t);
}

function effectiveSegment(
  q: Request['query'],
  forced?: 'all' | 'clients' | 'providers' | 'staff'
): AdminSegment {
  if (forced && forced !== 'all') {
    if (forced === 'clients' || forced === 'providers' || forced === 'staff') return forced;
  }
  const s = pickStr(q.segment);
  if (s === 'all' || s === 'clients' || s === 'providers' || s === 'staff') return s;
  return 'all';
}

function groupByToRecord(
  rows: Array<Record<string, unknown> & { _count: { _all: number } }>,
  key: string
): Record<string, number> {
  const o: Record<string, number> = {};
  for (const r of rows) {
    const k = r[key];
    const label = k == null || k === '' ? '(none)' : String(k);
    o[label] = (o[label] ?? 0) + r._count._all;
  }
  return o;
}

/** Shared filter parse for list + “select all matching id” (same where clause). */
export function buildAdminUserListOpts(
  q: Request['query'],
  forcedSegment?: 'all' | 'clients' | 'providers' | 'staff'
): BuildWhereOptions {
  const search = pickStr(q.q);
  const segment = effectiveSegment(q, forcedSegment);
  const roles = [
    ...toStrArray((q as Record<string, unknown>)['role']),
    ...toStrArray((q as Record<string, unknown>)['role[]']),
  ];
  const statuses = [
    ...toStrArray((q as Record<string, unknown>)['status']),
    ...toStrArray((q as Record<string, unknown>)['status[]']),
  ];
  const kycStatus = [
    ...toStrArray((q as Record<string, unknown>)['kycStatus']),
    ...toStrArray((q as Record<string, unknown>)['kycStatus[]']),
  ].filter((k) => KYC_STATUS.has(k));
  const kycPersonal = [
    ...toStrArray((q as Record<string, unknown>)['kycPersonal']),
    ...toStrArray((q as Record<string, unknown>)['kycPersonal[]']),
  ];
  const kycBusiness = [
    ...toStrArray((q as Record<string, unknown>)['kycBusiness']),
    ...toStrArray((q as Record<string, unknown>)['kycBusiness[]']),
  ];
  const genders = [
    ...toStrArray((q as Record<string, unknown>)['gender']),
    ...toStrArray((q as Record<string, unknown>)['gender[]']),
  ];
  const companyId = pickStr(q.companyId);
  const iv = pickStr(q.isVerified);
  let isVerified: boolean | undefined;
  if (iv === 'true') isVerified = true;
  if (iv === 'false') isVerified = false;
  const createdFrom = parseDate(
    pickStr(q.createdFrom) ?? (typeof (q as Record<string, string>).createdFrom === 'string'
      ? (q as Record<string, string>).createdFrom
      : undefined)
  );
  const createdTo = parseDate(
    pickStr(q.createdTo) ?? (typeof (q as Record<string, string>).createdTo === 'string'
      ? (q as Record<string, string>).createdTo
      : undefined)
  );
  const lastLoginFrom = parseDate(pickStr(q.lastLoginFrom));
  const lastLoginTo = parseDate(pickStr(q.lastLoginTo));
  const phoneContains = pickStr(q.phone);
  const addressContains = pickStr(q.address);
  const lastDeviceContains = pickStr(q.lastDevice);
  const lastIpContains = pickStr(q.lastIp);
  const ownedCompanyNameContains = pickStr(q.ownedCompanyName) ?? pickStr((q as Record<string, string>).ownedCompany);

  return {
    q: search,
    segment,
    roles,
    statuses,
    isVerified,
    kycStatus,
    kycPersonal,
    kycBusiness,
    genders,
    companyId,
    createdFrom,
    createdTo,
    lastLoginFrom,
    lastLoginTo,
    phoneContains,
    addressContains,
    lastDeviceContains,
    lastIpContains,
    ownedCompanyNameContains,
  };
}

export async function getAdminUserIds(
  req: Request,
  forcedSegment?: 'all' | 'clients' | 'providers' | 'staff'
): Promise<{ status: number; body: { ids: string[] } | { error: string } }> {
  const opts = buildAdminUserListOpts(req.query, forcedSegment);
  const where = buildUserWhere(opts, 'none');
  const rows = await prisma.user.findMany({ where, select: { id: true } });
  return { status: 200, body: { ids: rows.map((r) => r.id) } };
}

export async function getAdminUsersList(
  req: Request,
  forcedSegment?: 'all' | 'clients' | 'providers' | 'staff'
): Promise<{
  status: number;
  body: AdminUsersResponse | { error: string };
}> {
  const q = req.query;
  const sortBy = pickStr(q.sortBy) as SortKey | undefined;
  if (sortBy && !VALID_SORT.includes(sortBy as SortKey)) {
    return { status: 400, body: { error: `Invalid sortBy. Expected one of: ${VALID_SORT.join(', ')}` } };
  }
  const sKey: SortKey = (sortBy ?? 'createdAt') as SortKey;
  const sortDir: 'asc' | 'desc' = pickStr(q.sortDir) === 'asc' ? 'asc' : 'desc';
  const page = parseIntDefault(pickQueryStr(q, 'page'), 1, 1, 1_000_000);
  const pageSize = parseIntDefault(pickQueryStr(q, 'pageSize'), 25, 1, 200);
  const opts = buildAdminUserListOpts(q, forcedSegment);
  const where = buildUserWhere(opts, 'none');
  const skip = (page - 1) * pageSize;

  const whereKycFacet = buildUserWhere(opts, 'kyc');
  const noKycWhere: Prisma.UserWhereInput =
    Object.keys(whereKycFacet).length === 0
      ? { kyc: null }
      : { AND: [whereKycFacet, { kyc: null }] };

  const [total, rows, roleFacet, statusFacet, kycGroups, noKycCount, genderFacet] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userListInclude,
      orderBy: sortOrder(sKey, sortDir),
      skip,
      take: pageSize,
    }),
    pageSize > 100
      ? null
      : prisma.user.groupBy({
          by: ['role'],
          where: buildUserWhere(opts, 'roleAxis'),
          _count: { _all: true },
        }),
    pageSize > 100
      ? null
      : prisma.user.groupBy({
          by: ['status'],
          where: buildUserWhere(opts, 'status'),
          _count: { _all: true },
        }),
    pageSize > 100
      ? null
      : prisma.kYC.groupBy({
          by: ['status'],
          where: { user: whereKycFacet },
          _count: { _all: true },
        }),
    pageSize > 100 ? 0 : prisma.user.count({ where: noKycWhere }),
    pageSize > 100
      ? null
      : prisma.user.groupBy({
          by: ['gender'],
          where: buildUserWhere(opts, 'gender'),
          _count: { _all: true },
        }),
  ]);

  const kycStatusFacet: Record<string, number> = {};
  if (kycGroups) {
    for (const g of kycGroups) {
      kycStatusFacet[String(g.status)] = g._count._all;
    }
  }
  if (noKycCount > 0) kycStatusFacet['(none)'] = (kycStatusFacet['(none)'] ?? 0) + noKycCount;

  const body: AdminUsersResponse = {
    items: await enrichAdminRows(rows),
    total,
    page,
    pageSize,
    facets: {
      role: roleFacet ? groupByToRecord(roleFacet, 'role') : {},
      status: statusFacet ? groupByToRecord(statusFacet, 'status') : {},
      kycStatus: kycStatusFacet,
      gender: genderFacet ? groupByToRecord(genderFacet, 'gender') : {},
    },
  };
  return { status: 200, body };
}
