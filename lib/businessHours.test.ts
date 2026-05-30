import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma
vi.mock('./db.js', () => ({
  default: {
    businessHours: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from './db.js';
import { isWorkspaceOpenForWalkIn } from './businessHours.js';

const mockBusinessHours = prisma.businessHours as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
};

describe('isWorkspaceOpenForWalkIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Freeze time to Monday 10:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-25T10:00:00.000Z')); // Monday
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns false when no business hours configured for this day', async () => {
    mockBusinessHours.findUnique.mockResolvedValue(null);

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('not configured for this day');
  });

  it('returns false when business is closed on this day', async () => {
    mockBusinessHours.findUnique.mockResolvedValue({
      id: 'bh-1',
      workspaceId: 'workspace-1',
      dayOfWeek: 1, // Monday
      openTime: '09:00',
      closeTime: '17:00',
      isOpen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('closed on this day');
  });

  it('returns false when current time is before openTime', async () => {
    // System time is Monday 10:00 UTC, openTime is 11:00
    mockBusinessHours.findUnique.mockResolvedValue({
      id: 'bh-1',
      workspaceId: 'workspace-1',
      dayOfWeek: 1,
      openTime: '11:00',
      closeTime: '17:00',
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('Outside business hours');
    expect(result.reason).toContain('11:00 - 17:00 UTC');
  });

  it('returns false when current time is after closeTime', async () => {
    // System time is Monday 10:00 UTC, closeTime is 09:00
    mockBusinessHours.findUnique.mockResolvedValue({
      id: 'bh-1',
      workspaceId: 'workspace-1',
      dayOfWeek: 1,
      openTime: '05:00',
      closeTime: '09:00',
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(false);
    expect(result.reason).toContain('Outside business hours');
  });

  it('returns true when current time is within open hours', async () => {
    mockBusinessHours.findUnique.mockResolvedValue({
      id: 'bh-1',
      workspaceId: 'workspace-1',
      dayOfWeek: 1,
      openTime: '09:00',
      closeTime: '17:00',
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('returns true when current time equals openTime exactly', async () => {
    vi.setSystemTime(new Date('2026-05-25T09:00:00.000Z'));
    mockBusinessHours.findUnique.mockResolvedValue({
      id: 'bh-1',
      workspaceId: 'workspace-1',
      dayOfWeek: 1,
      openTime: '09:00',
      closeTime: '17:00',
      isOpen: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await isWorkspaceOpenForWalkIn('workspace-1');
    expect(result.isOpen).toBe(true);
  });
});