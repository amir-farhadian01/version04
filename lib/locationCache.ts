/**
 * lib/locationCache.ts — Core location cache logic
 *
 * Provides:
 *  - setUserLocation() with Haversine debounce (50m threshold)
 *  - getUserLocation() with cache-aside pattern
 *  - getNearbyProviders() using Redis GEO
 *  - Reverse geocode caching
 *  - Async flusher that batch-writes dirty locations to PostgreSQL every 5 min
 *
 * All functions gracefully fall back to in-memory cache when Redis is down.
 */

import prisma from './db.js';
import { getRedis, isRedisAvailable } from './redis.js';

// ─── Config (from env vars with defaults) ──────────────────────────────

const DEBOUNCE_METERS = parseInt(process.env.LOCATION_DEBOUNCE_METERS || '50', 10);
const FLUSH_INTERVAL_MS = parseInt(process.env.LOCATION_FLUSH_INTERVAL_MS || '300000', 10);
const CACHE_TTL_SECONDS = parseInt(process.env.LOCATION_CACHE_TTL_SECONDS || '300', 10);
const DIRTY_SET_TTL_SECONDS = parseInt(process.env.LOCATION_DIRTY_SET_TTL_SECONDS || '600', 10);
const GEO_CACHE_TTL_SECONDS = parseInt(process.env.LOCATION_GEO_CACHE_TTL || '60', 10);
const REVERSE_GEO_TTL_SECONDS = parseInt(process.env.LOCATION_REVERSE_GEO_TTL || '3600', 10);

// ─── Haversine ─────────────────────────────────────────────────────────

/**
 * Calculate distance in meters between two lat/lng points using Haversine formula.
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── User Location ─────────────────────────────────────────────────────

/**
 * Store a user's current location with debounce logic.
 *
 * If the distance from the last known position is less than DEBOUNCE_METERS,
 * only the TTL is renewed (no DB write queued).
 *
 * If the distance exceeds the threshold, the new position is stored in Redis
 * and the userId is added to the dirty set for async flush to PostgreSQL.
 *
 * @returns { cached, queued, skipped }
 *   - cached: true if the location was stored in Redis
 *   - queued: true if the location was added to the dirty set (needs DB flush)
 *   - skipped: true if the location was within debounce threshold (no action)
 */
export async function setUserLocation(
  userId: string,
  lat: number,
  lng: number,
): Promise<{ cached: boolean; queued: boolean; skipped: boolean }> {
  const redis = getRedis();
  const lastKey = `user:location:last:${userId}`;

  // 1. Read last known position from cache
  const lastPosStr = await redis.get(lastKey);

  if (lastPosStr) {
    const [lastLat, lastLng] = lastPosStr.split(',').map(Number);
    if (!isNaN(lastLat) && !isNaN(lastLng)) {
      const distance = haversineDistance(lastLat, lastLng, lat, lng);

      // 2. If within debounce threshold, just renew TTL
      if (distance < DEBOUNCE_METERS) {
        await redis.expire(lastKey, CACHE_TTL_SECONDS);
        return { cached: true, queued: false, skipped: true };
      }
    }
  }

  // 3. Store new position in cache
  await redis.set(lastKey, `${lat},${lng}`, 'EX', CACHE_TTL_SECONDS);

  // 4. Update GEO index (use 'user:locations' for all users)
  await redis.geoadd('user:locations', lng, lat, userId);

  // 5. Add to dirty set for async flush to PostgreSQL
  await redis.sadd('user:location:dirty', userId);

  // 6. Set TTL on dirty set so it doesn't accumulate if Redis crashes
  await redis.expire('user:location:dirty', DIRTY_SET_TTL_SECONDS);

  return { cached: true, queued: true, skipped: false };
}

/**
 * Get a user's current location from cache, falling back to DB.
 *
 * @returns { lat, lng } or null if no location is known
 */
export async function getUserLocation(
  userId: string,
): Promise<{ lat: number; lng: number } | null> {
  const redis = getRedis();
  const lastKey = `user:location:last:${userId}`;

  // 1. Try cache first
  const posStr = await redis.get(lastKey);
  if (posStr) {
    const [lat, lng] = posStr.split(',').map(Number);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }

  // 2. Fallback to DB
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { locationLat: true, locationLng: true, location: true },
    });

    if (user?.locationLat != null && user?.locationLng != null) {
      const result = { lat: user.locationLat, lng: user.locationLng };
      // Warm the cache
      await redis.set(lastKey, `${result.lat},${result.lng}`, 'EX', CACHE_TTL_SECONDS);
      return result;
    }

    // Try parsing JSON from location string
    if (user?.location) {
      try {
        const parsed = JSON.parse(user.location) as { lat: number; lng: number };
        if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
          await redis.set(lastKey, `${parsed.lat},${parsed.lng}`, 'EX', CACHE_TTL_SECONDS);
          return parsed;
        }
      } catch {
        // location is a plain string (e.g. "Toronto, ON"), not JSON
      }
    }
  } catch {
    // DB error — return null
  }

  return null;
}

// ─── Nearby Providers ──────────────────────────────────────────────────

/**
 * Find nearby providers using Redis GEO.
 *
 * @param lat - User's latitude
 * @param lng - User's longitude
 * @param radiusKm - Search radius in kilometers (default: 10)
 * @param limit - Maximum number of results (default: 20, max: 50)
 * @returns Array of nearby providers with distance
 */
export async function getNearbyProviders(
  lat: number,
  lng: number,
  radiusKm: number = 10,
  limit: number = 20,
): Promise<Array<{
  id: string;
  displayName: string;
  avatarUrl: string | null;
  distance: number | null;
  rating: number;
  reviewsCount: number;
  category: string;
  services: Array<{
    id: string;
    title: string;
    category: string;
    price: number | null;
    rating: number;
    reviewsCount: number;
  }>;
}>> {
  const redis = getRedis();
  const safeLimit = Math.min(50, Math.max(1, limit));

  // 1. Check cache for this query
  const cacheKey = `provider:nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${safeLimit}:${radiusKm}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as typeof result;
    } catch {
      // stale cache, ignore
    }
  }

  // 2. Query Redis GEO for nearby provider IDs
  let nearbyIds: string[] = [];
  try {
    // Use type assertion to handle union type (Redis | MemoryCache)
    // ioredis returns unknown[], MemoryCache returns string[]
    const result = await (redis as any).georadius(
      'provider:locations',
      lng, lat,
      radiusKm, 'km',
      'ASC',
      { COUNT: safeLimit },
    );
    nearbyIds = Array.isArray(result) ? (result as string[]) : [];
  } catch {
    // GEO query failed (e.g. in-memory fallback may not have data)
    // Fall through to DB query below
  }

  // 3. If GEO returned results, fetch provider details from DB
  let providers: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    locationLat: number | null;
    locationLng: number | null;
    services: Array<{
      id: string;
      title: string;
      category: string;
      price: number | null;
      rating: number;
      reviewsCount: number;
    }>;
  }> = [];

  if (nearbyIds.length > 0) {
    // Fetch providers that were found via GEO
    providers = await prisma.user.findMany({
      where: {
        id: { in: nearbyIds },
        role: 'provider',
        status: 'active',
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        locationLat: true,
        locationLng: true,
        services: {
          select: {
            id: true,
            title: true,
            category: true,
            price: true,
            rating: true,
            reviewsCount: true,
          },
          orderBy: { rating: 'desc' },
          take: 3,
        },
      },
    });

    // Preserve GEO sort order
    const idOrder = new Map(nearbyIds.map((id, i) => [id, i]));
    providers.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));
  } else {
    // Fallback: no GEO results (Redis empty or fallback mode) — get all active providers
    providers = await prisma.user.findMany({
      where: {
        role: 'provider',
        status: 'active',
        services: { some: {} },
      },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        locationLat: true,
        locationLng: true,
        services: {
          select: {
            id: true,
            title: true,
            category: true,
            price: true,
            rating: true,
            reviewsCount: true,
          },
          orderBy: { rating: 'desc' },
          take: 3,
        },
      },
      take: safeLimit,
    });
  }

  // 4. Calculate real distances
  const result = providers.map((p) => {
    let distance: number | null = null;
    if (p.locationLat != null && p.locationLng != null) {
      distance = Math.round(
        haversineDistance(lat, lng, p.locationLat, p.locationLng) / 1000 * 100,
      ) / 100; // round to 2 decimal places in km
    }

    const topService = p.services[0] ?? null;
    return {
      id: p.id,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      distance,
      rating: topService?.rating ?? 0,
      reviewsCount: topService?.reviewsCount ?? 0,
      category: topService?.category ?? 'General',
      services: p.services,
    };
  });

  // 5. Cache the result for 60 seconds
  await redis.set(cacheKey, JSON.stringify(result), 'EX', GEO_CACHE_TTL_SECONDS);

  return result;
}

// ─── Reverse Geocode Cache ─────────────────────────────────────────────

/**
 * Cache a reverse geocode result in Redis.
 */
export async function cacheReverseGeocode(
  lat: number,
  lng: number,
  data: Record<string, unknown>,
): Promise<void> {
  const redis = getRedis();
  const key = `geocode:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  await redis.set(key, JSON.stringify(data), 'EX', REVERSE_GEO_TTL_SECONDS);
}

/**
 * Get a cached reverse geocode result.
 */
export async function getCachedReverseGeocode(
  lat: number,
  lng: number,
): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  const key = `geocode:reverse:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  const cached = await redis.get(key);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── Order Location Cache ──────────────────────────────────────────────

/**
 * Cache an order's location in Redis.
 */
export async function setOrderLocation(
  orderId: string,
  lat: number,
  lng: number,
  address?: string,
): Promise<void> {
  const redis = getRedis();
  const key = `order:location:${orderId}`;

  // Store as a JSON string (Hash would be ideal but in-memory fallback may not support it)
  await redis.set(
    key,
    JSON.stringify({ lat, lng, address: address || '' }),
    'EX',
    86400, // 24 hours max
  );
}

/**
 * Get a cached order location.
 */
export async function getOrderLocation(
  orderId: string,
): Promise<{ lat: number; lng: number; address: string } | null> {
  const redis = getRedis();
  const key = `order:location:${orderId}`;
  const cached = await redis.get(key);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as { lat: number; lng: number; address: string };
  } catch {
    return null;
  }
}

/**
 * Invalidate (delete) a cached order location.
 */
export async function invalidateOrderLocation(orderId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(`order:location:${orderId}`);
}

// ─── Workspace Location Cache ──────────────────────────────────────────

/**
 * Cache a workspace's location in Redis and update the GEO index.
 */
export async function setWorkspaceLocation(
  workspaceId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const redis = getRedis();
  const key = `workspace:location:${workspaceId}`;

  await redis.set(key, `${lat},${lng}`, 'EX', CACHE_TTL_SECONDS);

  // Also update the provider GEO index (workspaces are provider locations)
  await redis.geoadd('provider:locations', lng, lat, workspaceId);
}

/**
 * Get a cached workspace location.
 */
export async function getWorkspaceLocation(
  workspaceId: string,
): Promise<{ lat: number; lng: number } | null> {
  const redis = getRedis();
  const key = `workspace:location:${workspaceId}`;
  const cached = await redis.get(key);
  if (!cached) return null;
  const [lat, lng] = cached.split(',').map(Number);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// ─── Async Flusher ─────────────────────────────────────────────────────

let flushTimer: ReturnType<typeof setInterval> | null = null;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Start the periodic flush scheduler.
 * Call this once during server startup (server.ts).
 */
export function startLocationFlusher(): void {
  if (flushTimer) return;

  flushTimer = setInterval(async () => {
    try {
      await flushDirtyLocations();
    } catch (err) {
      console.error('[LocationFlusher] Error:', err);
    }
  }, FLUSH_INTERVAL_MS);

  console.log(`[LocationFlusher] Started (interval: ${FLUSH_INTERVAL_MS}ms)`);
}

/**
 * Stop the flush scheduler.
 */
export function stopLocationFlusher(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
    console.log('[LocationFlusher] Stopped');
  }
}

/**
 * Flush all dirty locations from Redis to PostgreSQL in a batch transaction.
 */
async function flushDirtyLocations(): Promise<void> {
  const redis = getRedis();

  // 1. Get all dirty userIds
  const dirtyUserIds = await redis.smembers('user:location:dirty');
  if (dirtyUserIds.length === 0) {
    retryCount = 0;
    return;
  }

  console.log(`[LocationFlusher] Flushing ${dirtyUserIds.length} dirty locations`);

  // 2. Get the current position for each dirty user
  const updates: Array<{ userId: string; lat: number; lng: number }> = [];

  for (const userId of dirtyUserIds) {
    const posStr = await redis.get(`user:location:last:${userId}`);
    if (!posStr) continue;

    const [lat, lng] = posStr.split(',').map(Number);
    if (isNaN(lat) || isNaN(lng)) continue;

    updates.push({ userId, lat, lng });
  }

  if (updates.length === 0) {
    // All dirty entries had expired positions — clear the set
    await redis.del('user:location:dirty');
    retryCount = 0;
    return;
  }

  // 3. Batch update PostgreSQL
  try {
    await prisma.$transaction(
      updates.map(({ userId, lat, lng }) =>
        prisma.user.update({
          where: { id: userId },
          data: {
            locationLat: lat,
            locationLng: lng,
            // Also update the location string as JSON for backward compat
            location: JSON.stringify({ lat, lng }),
          },
        }),
      ),
    );

    // 4. Remove successfully flushed userIds from dirty set
    const successIds = updates.map((u) => u.userId);
    await redis.srem('user:location:dirty', ...successIds);

    console.log(`[LocationFlusher] Flushed ${successIds.length} locations successfully`);
    retryCount = 0;
  } catch (err) {
    retryCount++;
    console.error(`[LocationFlusher] Batch flush failed (attempt ${retryCount}/${MAX_RETRIES}):`, err);

    if (retryCount >= MAX_RETRIES) {
      // After max retries, clear the dirty set to prevent accumulation
      console.error('[LocationFlusher] Max retries reached, clearing dirty set');
      await redis.del('user:location:dirty');
      retryCount = 0;
    }
    // Otherwise, dirty set remains for next cycle retry
  }
}
