import {
  BookingMode,
  MatchAttemptStatus,
  Prisma,
  type Company,
  type ProviderServicePackage,
  type ServiceCatalog,
  type User,
} from '@prisma/client';
import prisma from '../db.js';

export type EligiblePackageRow = ProviderServicePackage & {
  workspace: Company;
  provider: User;
  serviceCatalog: ServiceCatalog;
};

export interface EligiblePackage {
  package: EligiblePackageRow;
  score: number;
  distanceKm: number | null;
  breakdown: Record<string, number>;
}

/** Multipliers applied to each breakdown term when ranking (customer `orderPriorities.weights`). */
export type ScoreWeightMultipliers = Partial<{
  distance: number;
  rating: number;
  price: number;
  responseRate: number;
}>;

function scoreFromBreakdown(
  breakdown: Record<string, number>,
  weightMultipliers?: ScoreWeightMultipliers | null,
): number {
  const wd = weightMultipliers?.distance ?? 1;
  const wr = weightMultipliers?.rating ?? 1;
  const wp = weightMultipliers?.price ?? 1;
  const wrr = weightMultipliers?.responseRate ?? 1;
  return (
    wd * (breakdown.distanceTerm ?? 0) +
    wr * (breakdown.ratingTerm ?? 0) +
    wp * (breakdown.priceTerm ?? 0) +
    wrr * (breakdown.responseRateTerm ?? 0)
  );
}

type TargetMode = 'booking' | 'direct_booking' | 'hybrid' | 'quote_first' | 'walk_in';

const EARTH_KM = 6371;
const MAX_MATCH_KM = 50;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Best-effort parse of `Company.location` JSON for distance. */
export function parseWorkspaceLatLng(location: Prisma.JsonValue): { lat: number; lng: number } | null {
  if (location == null || typeof location !== 'object' || Array.isArray(location)) return null;
  const o = location as Record<string, unknown>;
  const latRaw = o.lat ?? o.latitude;
  const lngRaw = o.lng ?? o.longitude;
  const lat = typeof latRaw === 'number' ? latRaw : typeof latRaw === 'string' ? Number.parseFloat(latRaw) : Number.NaN;
  const lng = typeof lngRaw === 'number' ? lngRaw : typeof lngRaw === 'string' ? Number.parseFloat(lngRaw) : Number.NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

/**
 * ADR-0028 / Sprint I: catalog.lockedBookingMode wins, else package.bookingMode, else booking.
 */
export function resolveEffectiveBookingMode(
  catalog: Pick<ServiceCatalog, 'lockedBookingMode'>,
  pkg: Pick<ProviderServicePackage, 'bookingMode'>,
): 'booking' | 'direct_booking' | 'hybrid' | 'quote_first' | 'walk_in' {
  const lock = catalog.lockedBookingMode?.trim();
  if (lock === 'booking' || lock === 'direct_booking' || lock === 'hybrid' || lock === 'quote_first' || lock === 'walk_in') {
    return lock;
  }
  if (pkg.bookingMode === BookingMode.booking) return 'booking';
  if (pkg.bookingMode === BookingMode.direct_booking) return 'direct_booking';
  if (pkg.bookingMode === BookingMode.hybrid) return 'hybrid';
  if (pkg.bookingMode === BookingMode.quote_first) return 'quote_first';
  if (pkg.bookingMode === BookingMode.walk_in) return 'walk_in';
  return 'booking';
}

function providerResponseRate(
  tallies: Map<string, { accepted: number; declined: number; expired: number }>,
  providerId: string,
): number {
  const t = tallies.get(providerId) ?? { accepted: 0, declined: 0, expired: 0 };
  const denom = t.accepted + t.declined + t.expired;
  if (denom === 0) return 0.8;
  return t.accepted / denom;
}

/**
 * Eligible packages for an order by target mode, sorted by score ascending (best first).
 */
async function findEligiblePackagesForOfferByMode(
  orderId: string,
  mode: TargetMode,
  excludePackageIds: string[] = [],
  requireNoActiveMatch = true,
  weightMultipliers?: ScoreWeightMultipliers | null,
): Promise<EligiblePackage[]> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { serviceCatalog: true },
    });
    if (!order?.serviceCatalog) {
      return [];
    }

    if (requireNoActiveMatch) {
      const blocking = await prisma.offerMatchAttempt.findFirst({
        where: {
          offerId: orderId,
          status: { in: [MatchAttemptStatus.accepted, MatchAttemptStatus.matched] },
        },
      });
      if (blocking) {
        return [];
      }
    }

    const rows = await prisma.providerServicePackage.findMany({
      where: {
        serviceCatalogId: order.serviceCatalogId,
        isActive: true,
        archivedAt: null,
        ...(excludePackageIds.length > 0 ? { id: { notIn: excludePackageIds } } : {}),
      },
      include: {
        workspace: true,
        provider: true,
        serviceCatalog: true,
      },
    });

    const thirtyAgo = new Date(Date.now() - THIRTY_DAYS_MS);
    const providerIds = [...new Set(rows.map((r) => r.providerId))];

    const [ratingGroups, attemptGroups] = await Promise.all([
      providerIds.length
        ? prisma.service.groupBy({
            by: ['providerId'],
            where: { providerId: { in: providerIds } },
            _avg: { rating: true },
          })
        : Promise.resolve([]),
      providerIds.length
        ? prisma.offerMatchAttempt.groupBy({
            by: ['providerId', 'status'],
            where: {
              providerId: { in: providerIds },
              invitedAt: { gte: thirtyAgo },
              status: {
                in: [
                  MatchAttemptStatus.accepted,
                  MatchAttemptStatus.declined,
                  MatchAttemptStatus.expired,
                ],
              },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const ratingByProvider = new Map<string, number>();
    for (const g of ratingGroups) {
      ratingByProvider.set(g.providerId, g._avg.rating ?? 0);
    }

    const tallies = new Map<string, { accepted: number; declined: number; expired: number }>();
    for (const g of attemptGroups) {
      let t = tallies.get(g.providerId);
      if (!t) {
        t = { accepted: 0, declined: 0, expired: 0 };
        tallies.set(g.providerId, t);
      }
      if (g.status === MatchAttemptStatus.accepted) t.accepted += g._count._all;
      else if (g.status === MatchAttemptStatus.declined) t.declined += g._count._all;
      else if (g.status === MatchAttemptStatus.expired) t.expired += g._count._all;
    }

    const orderLat = order.locationLat;
    const orderLng = order.locationLng;
    const hasOrderCoords =
      orderLat != null && orderLng != null && Number.isFinite(orderLat) && Number.isFinite(orderLng);

    const out: EligiblePackage[] = [];

    for (const pkg of rows) {
      const { workspace, provider, serviceCatalog } = pkg;
      if (workspace.kycStatus !== 'verified') continue;
      if (!provider.isVerified || provider.status !== 'active') continue;
      if (resolveEffectiveBookingMode(serviceCatalog, pkg) !== mode) continue;

      let distanceKm: number | null = null;
      if (hasOrderCoords) {
        const ws = parseWorkspaceLatLng(workspace.location);
        if (ws) {
          distanceKm = haversineKm(orderLat!, orderLng!, ws.lat, ws.lng);
          if (distanceKm > MAX_MATCH_KM) continue;
        }
      }

      const rating = ratingByProvider.get(provider.id) ?? 0;
      const responseRate = providerResponseRate(tallies, provider.id);
      const distTerm = distanceKm ?? 0;

      const breakdown: Record<string, number> = {
        distanceTerm: distTerm * 1.0,
        ratingTerm: -rating * 5,
        priceTerm: pkg.finalPrice / 100,
        responseRateTerm: -responseRate * 10,
      };
      const score = scoreFromBreakdown(breakdown, weightMultipliers);

      out.push({
        package: pkg,
        score,
        distanceKm,
        breakdown: { ...breakdown, rawRating: rating, responseRate },
      });
    }

    out.sort((a, b) => a.score - b.score);
    return out;
  } catch (err) {
    console.error('findEligiblePackagesForOffer', err);
    return [];
  }
}

/**
 * Eligible direct_booking packages — packages where the customer can book directly.
 */
export async function findEligiblePackagesForOffer(
  orderId: string,
  excludePackageIds: string[] = [],
): Promise<EligiblePackage[]> {
  return findEligiblePackagesForOfferByMode(orderId, 'direct_booking', excludePackageIds, true, null);
}

/**
 * Eligible quote_first packages — packages where the customer must request a quote first.
 * Same eligibility rules as `findEligiblePackagesForOffer`, filtered to quote_first mode.
 */
export async function findEligibleNegotiationPackagesForOffer(
  orderId: string,
  excludePackageIds: string[] = [],
  weightMultipliers?: ScoreWeightMultipliers | null,
): Promise<EligiblePackage[]> {
  return findEligiblePackagesForOfferByMode(
    orderId,
    'quote_first',
    excludePackageIds,
    false,
    weightMultipliers,
  );
}

type OrderCoords = { locationLat: number | null; locationLng: number | null };

/**
 * Score a single package against an order (for admin override when strict eligibility differs).
 */
export async function scoreProviderPackageForOrder(
  order: OrderCoords,
  pkg: EligiblePackageRow,
): Promise<EligiblePackage> {
  const thirtyAgo = new Date(Date.now() - THIRTY_DAYS_MS);
  const [ratingRow, attemptGroups] = await Promise.all([
    prisma.service.aggregate({
      where: { providerId: pkg.providerId },
      _avg: { rating: true },
    }),
    prisma.offerMatchAttempt.groupBy({
      by: ['status'],
      where: {
        providerId: pkg.providerId,
        invitedAt: { gte: thirtyAgo },
        status: {
          in: [
            MatchAttemptStatus.accepted,
            MatchAttemptStatus.declined,
            MatchAttemptStatus.expired,
          ],
        },
      },
      _count: { _all: true },
    }),
  ]);

  const t = { accepted: 0, declined: 0, expired: 0 };
  for (const g of attemptGroups) {
    if (g.status === MatchAttemptStatus.accepted) t.accepted += g._count._all;
    else if (g.status === MatchAttemptStatus.declined) t.declined += g._count._all;
    else if (g.status === MatchAttemptStatus.expired) t.expired += g._count._all;
  }
  const denom = t.accepted + t.declined + t.expired;
  const responseRate = denom === 0 ? 0.8 : t.accepted / denom;
  const rating = ratingRow._avg.rating ?? 0;

  const orderLat = order.locationLat;
  const orderLng = order.locationLng;
  const hasOrderCoords =
    orderLat != null && orderLng != null && Number.isFinite(orderLat) && Number.isFinite(orderLng);
  let distanceKm: number | null = null;
  if (hasOrderCoords) {
    const ws = parseWorkspaceLatLng(pkg.workspace.location);
    if (ws) {
      distanceKm = haversineKm(orderLat!, orderLng!, ws.lat, ws.lng);
    }
  }

  const distTerm = distanceKm ?? 0;
  const score = distTerm * 1.0 - rating * 5 + (pkg.finalPrice / 100) - responseRate * 10;
  const breakdown: Record<string, number> = {
    distanceTerm: distTerm * 1.0,
    ratingTerm: -rating * 5,
    priceTerm: pkg.finalPrice / 100,
    responseRateTerm: -responseRate * 10,
    rawRating: rating,
    responseRate,
  };

  return { package: pkg, score, distanceKm, breakdown };
}
