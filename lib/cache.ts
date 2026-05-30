/**
 * In-memory cache — replaces Redis for local dev simplicity.
 * Redis was removed because it had no host port mapping and caused
 * connection errors in local dev. For production scale, re-add Redis
 * and swap the Map for ioredis calls.
 *
 * This module now includes GEO and Set operations so it can serve as
 * a drop-in fallback when Redis is unavailable (see lib/redis.ts).
 */

// ─── Internal data structures ───────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number | null;
}

/** Internal store for GEO sets: key → member → {lat, lng} */
const geoStore = new Map<string, Map<string, { lat: number; lng: number }>>();

/** Internal store for Set operations: key → Set<string> */
const setStore = new Map<string, Set<string>>();

const store = new Map<string, CacheEntry>();

function isExpired(entry: CacheEntry): boolean {
  return entry.expiresAt !== null && Date.now() > entry.expiresAt;
}

// ─── Haversine helper ──────────────────────────────────────────────────

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

// ─── Memory cache object ───────────────────────────────────────────────

// Mimics the ioredis subset used in this codebase
const memoryCache = {
  // ── Basic string operations ──────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const entry = store.get(key);
    if (!entry || isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry.value;
  },

  async set(key: string, value: string, exFlag?: 'EX', ttlSeconds?: number): Promise<'OK'> {
    const expiresAt = exFlag === 'EX' && ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
    store.set(key, { value, expiresAt });
    return 'OK';
  },

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (store.delete(key)) count++;
    }
    return count;
  },

  async ping(): Promise<'PONG'> {
    return 'PONG';
  },

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return [...store.keys()].filter(k => regex.test(k));
  },

  on(_event: string, _cb: (...args: unknown[]) => void): void {
    // no-op — compatibility shim for ioredis .on('error') / .on('connect')
  },

  // ── GEO operations (in-memory fallback for Redis GEO) ────────────────

  /**
   * Add a member to a GEO set.
   * Note: ioredis uses (key, lng, lat, member) order.
   */
  async geoadd(key: string, lng: number, lat: number, member: string): Promise<number> {
    if (!geoStore.has(key)) {
      geoStore.set(key, new Map());
    }
    const members = geoStore.get(key)!;
    if (members.has(member)) {
      members.set(member, { lat, lng });
      return 0; // updated existing
    }
    members.set(member, { lat, lng });
    return 1; // added new
  },

  /**
   * Query members within a radius from a point using Haversine.
   * Returns member IDs sorted by distance (ascending).
   */
  async georadius(
    key: string, lng: number, lat: number,
    radius: number, unit: 'km' | 'm',
    order?: 'ASC' | 'DESC',
    options?: { COUNT?: number },
  ): Promise<string[]> {
    const members = geoStore.get(key);
    if (!members || members.size === 0) return [];

    const radiusMeters = unit === 'km' ? radius * 1000 : radius;

    const results: Array<{ member: string; distance: number }> = [];
    for (const [member, pos] of members.entries()) {
      const dist = haversineDistance(lat, lng, pos.lat, pos.lng);
      if (dist <= radiusMeters) {
        results.push({ member, distance: dist });
      }
    }

    // Sort by distance
    results.sort((a, b) => {
      if (order === 'DESC') return b.distance - a.distance;
      return a.distance - b.distance;
    });

    // Apply COUNT limit
    const limited = options?.COUNT ? results.slice(0, options.COUNT) : results;

    return limited.map(r => r.member);
  },

  /**
   * Get distance between two members in a GEO set.
   */
  async geodist(
    key: string, member1: string, member2: string,
    unit: 'km' | 'm' = 'm',
  ): Promise<number | null> {
    const members = geoStore.get(key);
    if (!members) return null;

    const pos1 = members.get(member1);
    const pos2 = members.get(member2);
    if (!pos1 || !pos2) return null;

    const distMeters = haversineDistance(pos1.lat, pos1.lng, pos2.lat, pos2.lng);
    if (unit === 'km') return distMeters / 1000;
    return distMeters;
  },

  // ── Set operations ───────────────────────────────────────────────────

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!setStore.has(key)) {
      setStore.set(key, new Set());
    }
    const set = setStore.get(key)!;
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    return added;
  },

  async smembers(key: string): Promise<string[]> {
    const set = setStore.get(key);
    if (!set) return [];
    return [...set];
  },

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = setStore.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed++;
    }
    return removed;
  },

  async sismember(key: string, member: string): Promise<number> {
    const set = setStore.get(key);
    if (!set) return 0;
    return set.has(member) ? 1 : 0;
  },

  // ── TTL / Expiry ─────────────────────────────────────────────────────

  async expire(key: string, seconds: number): Promise<number> {
    const entry = store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  },

  async ttl(key: string): Promise<number> {
    const entry = store.get(key);
    if (!entry) return -2; // key does not exist
    if (entry.expiresAt === null) return -1; // no expiry
    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return Math.max(0, remaining);
  },
};

export type MemoryCache = typeof memoryCache;

let instance: MemoryCache | null = null;

export function getRedis(): MemoryCache {
  if (!instance) {
    instance = memoryCache;
    console.log('Cache: using in-memory store (Redis removed)');
  }
  return instance;
}

export default getRedis;

// ─── Slot reservation helpers (in-memory fallback for lib/redis.ts) ────

/**
 * Build a slot reservation key for the in-memory store.
 * Format: neighborly:slot:{providerId}:{date}:{slotKey}
 */
function buildSlotKey(providerId: string, date: string, sk: string): string {
  return `neighborly:slot:${providerId}:${date}:${sk}`;
}

/**
 * Build a slot key pattern for KEYS matching.
 * Format: neighborly:slot:{providerId}:{date}:*
 */
function buildSlotPattern(providerId: string, date: string): string {
  return `neighborly:slot:${providerId}:${date}:*`;
}

/**
 * In-memory equivalent of Redis SET NX EX for slot reservation.
 *
 * @returns true if the slot was acquired, false if already held.
 */
export async function cacheReserveSlot(
  providerId: string,
  date: string,
  slotKey: string,
  ttlSecs: number,
): Promise<boolean> {
  try {
    const key = buildSlotKey(providerId, date, slotKey);
    const entry = store.get(key);
    if (entry && !isExpired(entry)) {
      return false; // already reserved
    }
    const expiresAt = Date.now() + ttlSecs * 1000;
    store.set(key, { value: '1', expiresAt });
    return true;
  } catch (err) {
    console.error('[Cache] cacheReserveSlot error:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * In-memory equivalent of Redis DEL for slot release.
 */
export async function cacheReleaseSlot(
  providerId: string,
  date: string,
  slotKey: string,
): Promise<void> {
  try {
    const key = buildSlotKey(providerId, date, slotKey);
    store.delete(key);
  } catch (err) {
    console.error('[Cache] cacheReleaseSlot error:', err instanceof Error ? err.message : err);
  }
}

/**
 * In-memory equivalent of Redis KEYS for getting reserved slots.
 *
 * @returns Array of slot keys (the {slotKey} part only, e.g. ["staffId:09:00", "staffId:10:00"])
 */
export async function cacheGetReservedSlots(
  providerId: string,
  date: string,
): Promise<string[]> {
  try {
    const pattern = buildSlotPattern(providerId, date);
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const prefix = `neighborly:slot:${providerId}:${date}:`;
    const results: string[] = [];

    for (const [key, entry] of store.entries()) {
      if (regex.test(key) && !isExpired(entry)) {
        results.push(key.startsWith(prefix) ? key.slice(prefix.length) : key);
      }
    }

    return results;
  } catch (err) {
    console.error('[Cache] cacheGetReservedSlots error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * In-memory equivalent of the Lua-based reserveSlotAtomic.
 *
 * Non-atomic (best-effort) — checks capacity then tries to reserve.
 *
 * @returns { success: true } if reserved, or { success: false, code } on failure
 */
export async function cacheReserveSlotAtomic(
  providerId: string,
  date: string,
  slotKey: string,
  ttlSecs: number,
  maxDailyBookings: number,
): Promise<{ success: boolean; code?: string }> {
  try {
    // Count existing non-expired reserved slots
    const existing = await cacheGetReservedSlots(providerId, date);

    // Check capacity
    if (existing.length >= maxDailyBookings) {
      return { success: false, code: 'CAPACITY_EXCEEDED' };
    }

    // Try to reserve the slot
    const reserved = await cacheReserveSlot(providerId, date, slotKey, ttlSecs);
    if (!reserved) {
      return { success: false, code: 'SLOT_ALREADY_RESERVED' };
    }

    return { success: true };
  } catch (err) {
    console.error('[Cache] cacheReserveSlotAtomic error:', err instanceof Error ? err.message : err);
    return { success: false, code: 'CACHE_ERROR' };
  }
}
