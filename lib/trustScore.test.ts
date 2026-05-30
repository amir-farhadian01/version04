import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAggregate, mockUpsert } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock('./db.js', () => ({
  default: {
    orderReview: {
      aggregate: mockAggregate,
    },
    businessTrustScore: {
      upsert: mockUpsert,
    },
  },
}));

import { recalculateWorkspaceTrustScore } from './trustScore.js';

describe('recalculateWorkspaceTrustScore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates avgRating from review average', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    });
    mockUpsert.mockResolvedValue({});

    await recalculateWorkspaceTrustScore('workspace-1');

    expect(mockAggregate).toHaveBeenCalledWith({
      where: {
        order: {
          matchedWorkspaceId: 'workspace-1',
          status: { in: ['completed', 'closed'] },
        },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      create: {
        workspaceId: 'workspace-1',
        avgRating: 4.5,
        reviewCount: 2,
      },
      update: {
        avgRating: 4.5,
        reviewCount: 2,
      },
    });
  });

  it('handles zero reviews gracefully', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    });
    mockUpsert.mockResolvedValue({});

    await recalculateWorkspaceTrustScore('workspace-empty');

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-empty' },
      create: {
        workspaceId: 'workspace-empty',
        avgRating: 0,
        reviewCount: 0,
      },
      update: {
        avgRating: 0,
        reviewCount: 0,
      },
    });
  });

  it('handles single review', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { rating: 3 },
      _count: { rating: 1 },
    });
    mockUpsert.mockResolvedValue({});

    await recalculateWorkspaceTrustScore('workspace-single');

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-single' },
      create: {
        workspaceId: 'workspace-single',
        avgRating: 3,
        reviewCount: 1,
      },
      update: {
        avgRating: 3,
        reviewCount: 1,
      },
    });
  });

  it('rounds to 2 decimal places', async () => {
    mockAggregate.mockResolvedValue({
      _avg: { rating: 3.333333333 },
      _count: { rating: 6 },
    });
    mockUpsert.mockResolvedValue({});

    await recalculateWorkspaceTrustScore('workspace-rounding');

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-rounding' },
      create: {
        workspaceId: 'workspace-rounding',
        avgRating: 3.33,
        reviewCount: 6,
      },
      update: {
        avgRating: 3.33,
        reviewCount: 6,
      },
    });
  });
});