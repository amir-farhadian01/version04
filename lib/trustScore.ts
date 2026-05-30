import prisma from './db.js';

/**
 * Recalculates BusinessTrustScore.avgRating and reviewCount for a workspace
 * based on all reviews for completed orders matched to that workspace.
 * Called after every new review submission.
 */
export async function recalculateWorkspaceTrustScore(workspaceId: string): Promise<void> {
  const result = await prisma.orderReview.aggregate({
    where: {
      order: {
        matchedWorkspaceId: workspaceId,
        status: { in: ['completed', 'closed'] },
      },
    },
    _avg: {
      rating: true,
    },
    _count: {
      rating: true,
    },
  });

  const avgRating = Math.round((result._avg.rating ?? 0) * 100) / 100;
  const reviewCount = result._count.rating;

  await prisma.businessTrustScore.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      avgRating,
      reviewCount,
    },
    update: {
      avgRating,
      reviewCount,
    },
  });
}