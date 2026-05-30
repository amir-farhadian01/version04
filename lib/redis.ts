/**
 * lib/redis.ts — Redis connection manager with graceful fallback
 *
 * Provides a unified getRedis() that returns either an ioredis client
 * (when Redis is available) or the in-memory Map-based cache from
 * lib/cache.ts (when Redis is down).
 *
 * This is the PRIMARY cache module. All other modules should import
 * getRedis from here, NOT from lib/cache.ts directly.
 *
 * Also exports slot reservation functions (G1/G15 — capacity validation
 * before match using Redis slot locking).
 */

import Redis from 'ioredis';
import {
  getRedis as getMemoryCache,
  cacheReserveSlot,
  cacheReleaseSlot,
  cacheGetReservedSlots,
  cacheReserveSlotAtomic,
} from './cache.js';

type RedisClient = Redis | ReturnType<typeof getMemoryCache>;

let client: RedisClient | null = null;
let redisAvailable = false;

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  retryStrategy: (times: number) => number | null;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
}

const DEFAULT_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'neighborly:',
  retryStrategy: (times: number) => {
    if (times > 3) return null; // stop retrying after 3 attempts
    return Math.min(times * 200, 1000); // 200ms, 400ms, 600ms
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
};

function createRedisClient(config: RedisConfig = DEFAULT_CONFIG): Redis {
  const redis = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    retryStrategy: config.retryStrategy,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    enableReadyCheck: config.enableReadyCheck,
    lazyConnect: config.lazyConnect,
  });

  redis.on('connect', () => {
    redisAvailable = true;
    console.log('[Redis] Connected');
  });

  redis.on('error', (err) => {
    redisAvailable = false;
    console.error('[Redis] Error:', err.message);
  });

  redis.on('close', () => {
    redisAvailable = false;
    console.warn('[Redis] Connection closed, falling back to in-memory cache');
  });

  redis.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return redis;
}

/**
 * Get the Redis client (or in-memory fallback).
 * Creates the client on first call if it doesn't exist.
 */
export function getRedis(): RedisClient {
  if (!client) {
    try {
      client = createRedisClient();
    } catch {
      console.warn('[Redis] Failed to create client, using in-memory fallback');
      client = getMemoryCache();
    }
  }
  return client;
}

/**
 * Check if Redis is currently available (connected and not in error state).
 */
export function isRedisAvailable(): boolean {
  return redisAvailable;
}

/**
 * Ping Redis to verify connectivity.
 * Returns true if Redis responds, false otherwise.
 */
export async function pingRedis(): Promise<boolean> {
  try {
    const r = getRedis();
    if ('ping' in r && typeof r.ping === 'function') {
      await r.ping();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─── Safe Redis call helper ─────────────────────────────────────────────

/**
 * Wraps a Redis call with try/catch error handling.
 * Returns the result of the call, or the fallback value on error.
 */
export async function safeRedisCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error('[Redis] safeRedisCall error:', err instanceof Error ? err.message : err);
    return fallback;
  }
}

/**
 * Returns the raw Redis client if available, or null.
 * Useful for callers that need to check availability before making calls.
 */
export function getRedisClient(): Redis | null {
  const r = getRedis();
  if ('ping' in r && typeof r.ping === 'function') {
    return redisAvailable ? (r as Redis) : null;
  }
  return null;
}

// ─── Slot key helpers ───────────────────────────────────────────────────

/**
 * Build a slot reservation key.
 * Format: neighborly:slot:{providerId}:{date}:{slotKey}
 * Where slotKey = {staffId}:{HH}:{MM}
 */
function buildSlotKey(providerId: string, date: string, sk: string): string {
  return `slot:${providerId}:${date}:${sk}`;
}

/**
 * Build a slot key pattern for KEYS/SCAN.
 * Format: neighborly:slot:{providerId}:{date}:*
 */
function buildSlotPattern(providerId: string, date: string): string {
  return `slot:${providerId}:${date}:*`;
}

// ─── Slot reservation functions ─────────────────────────────────────────

/**
 * Atomically reserve a time slot for a provider on a given date.
 *
 * Key format: neighborly:slot:{providerId}:{date}:{slotKey}
 * Uses SET NX EX for atomic reservation.
 *
 * @returns true if the slot was acquired, false if already held.
 */
export async function reserveSlot(
  providerId: string,
  date: string,
  slotKey: string,
  ttlSecs: number,
): Promise<boolean> {
  const r = getRedis();
  const key = buildSlotKey(providerId, date, slotKey);

  // If it's a real Redis client, use SET NX EX
  if ('set' in r && typeof r.set === 'function' && redisAvailable) {
    return safeRedisCall(async () => {
      const result = await (r as Redis).set(key, '1', 'EX', ttlSecs, 'NX');
      return result === 'OK';
    }, false);
  }

  // Fall back to in-memory cache
  return cacheReserveSlot(providerId, date, slotKey, ttlSecs);
}

/**
 * Release a previously reserved slot.
 */
export async function releaseSlot(
  providerId: string,
  date: string,
  slotKey: string,
): Promise<void> {
  const r = getRedis();
  const key = buildSlotKey(providerId, date, slotKey);

  if ('del' in r && typeof r.del === 'function' && redisAvailable) {
    await safeRedisCall(async () => {
      await (r as Redis).del(key);
    }, undefined);
    return;
  }

  // Fall back to in-memory cache
  return cacheReleaseSlot(providerId, date, slotKey);
}

/**
 * Get all reserved slot keys for a provider on a given date.
 *
 * @returns Array of slot keys (the {slotKey} part only, e.g. ["staffId:09:00", "staffId:10:00"])
 */
export async function getReservedSlots(
  providerId: string,
  date: string,
): Promise<string[]> {
  const r = getRedis();
  const pattern = buildSlotPattern(providerId, date);

  if ('keys' in r && typeof r.keys === 'function' && redisAvailable) {
    return safeRedisCall(async () => {
      const fullKeys = await (r as Redis).keys(pattern);
      // Strip the keyPrefix + "slot:{providerId}:{date}:" prefix to get just the slotKey
      const prefix = `neighborly:slot:${providerId}:${date}:`;
      return fullKeys.map((k: string) => k.startsWith(prefix) ? k.slice(prefix.length) : k);
    }, []);
  }

  // Fall back to in-memory cache
  return cacheGetReservedSlots(providerId, date);
}

/**
 * Atomic slot reservation with capacity check.
 *
 * Uses a Lua script to atomically:
 * 1. Count existing reserved slots for the provider+date
 * 2. If count >= maxDailyBookings → return CAPACITY_EXCEEDED
 * 3. If slot key already exists → return SLOT_ALREADY_RESERVED
 * 4. Otherwise SET NX EX the slot key → return success
 *
 * @returns { success: true } if reserved, or { success: false, code } on failure
 */
export async function reserveSlotAtomic(
  providerId: string,
  date: string,
  slotKey: string,
  ttlSecs: number,
  maxDailyBookings: number,
): Promise<{ success: boolean; code?: string }> {
  const r = getRedis();
  const key = buildSlotKey(providerId, date, slotKey);
  const pattern = buildSlotPattern(providerId, date);

  if ('eval' in r && typeof r.eval === 'function' && redisAvailable) {
    return safeRedisCall(async () => {
      const luaScript = `
        local slotKey = KEYS[1]
        local pattern = KEYS[2]
        local maxDaily = tonumber(ARGV[1])
        local ttl = tonumber(ARGV[2])

        -- Count existing reserved slots
        local keys = redis.call('KEYS', pattern)
        local count = #keys

        -- Check capacity
        if count >= maxDaily then
          return {0, "CAPACITY_EXCEEDED"}
        end

        -- Try to reserve the slot
        local result = redis.call('SET', slotKey, '1', 'NX', 'EX', ttl)
        if result == false or result == nil then
          return {0, "SLOT_ALREADY_RESERVED"}
        end

        return {1, "OK"}
      `;

      const result = await (r as Redis).eval(
        luaScript,
        2, // number of keys
        `neighborly:${key}`,
        `neighborly:${pattern}`,
        maxDailyBookings.toString(),
        ttlSecs.toString(),
      );

      if (Array.isArray(result) && result.length === 2) {
        const status = Number(result[0]);
        const code = String(result[1]);
        if (status === 1) {
          return { success: true };
        }
        return { success: false, code };
      }

      // Unexpected response format — treat as failure
      return { success: false, code: 'UNKNOWN_ERROR' };
    }, { success: false, code: 'REDIS_ERROR' });
  }

  // Fall back to in-memory cache (non-atomic but best-effort)
  return cacheReserveSlotAtomic(providerId, date, slotKey, ttlSecs, maxDailyBookings);
}
