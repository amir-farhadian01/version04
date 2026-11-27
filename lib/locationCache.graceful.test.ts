import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Redis is an optional service (PORTS.md). When it is down, ioredis commands
 * throw "Connection is closed." — locationCache must degrade gracefully:
 * cache writes become no-ops and cache reads fall back, so request paths
 * (e.g. order submit → setOrderLocation) never 500 because of the cache.
 */
vi.mock('./redis.js', () => {
  const failing = {
    get: vi.fn(async () => { throw new Error('Connection is closed.'); }),
    set: vi.fn(async () => { throw new Error('Connection is closed.'); }),
    del: vi.fn(async () => { throw new Error('Connection is closed.'); }),
    expire: vi.fn(async () => { throw new Error('Connection is closed.'); }),
    geoadd: vi.fn(async () => { throw new Error('Connection is closed.'); }),
    sadd: vi.fn(async () => { throw new Error('Connection is closed.'); }),
  };
  return {
    getRedis: vi.fn(() => failing),
    isRedisAvailable: vi.fn(() => false),
  };
});

import { setOrderLocation, getOrderLocation, setWorkspaceLocation } from './locationCache.js';

describe('locationCache graceful degradation (Redis down)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setOrderLocation resolves without throwing when Redis is closed', async () => {
    await expect(setOrderLocation('order-1', 49.2827, -123.1207, '100 Main St')).resolves.toBeUndefined();
  });

  it('getOrderLocation falls back to null when Redis is closed', async () => {
    await expect(getOrderLocation('order-1')).resolves.toBeNull();
  });

  it('setWorkspaceLocation resolves without throwing when Redis is closed', async () => {
    await expect(setWorkspaceLocation('ws-1', 49.2827, -123.1207)).resolves.toBeUndefined();
  });
});
