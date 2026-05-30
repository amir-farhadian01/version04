import { MatchAttemptStatus } from '@prisma/client';
import prisma from './db.js';
import { listMyWorkspaces } from './workspaceAccess.js';

/** Attempt states where a workspace is actively in the negotiation funnel for an order. */
export const PRE_MATCH_INVITE_STATUSES: MatchAttemptStatus[] = [
  MatchAttemptStatus.invited,
  MatchAttemptStatus.accepted,
  MatchAttemptStatus.matched,
];

/**
 * True when the user belongs to a workspace that has an active inbox attempt for this order
 * (same gate as order-scoped chat `invited_provider` read).
 */
export async function userHasActiveInboxAttemptForOrder(userId: string, orderId: string): Promise<boolean> {
  const workspaces = await listMyWorkspaces(userId);
  const ids = workspaces.map((w) => w.id);
  if (!ids.length) return false;
  const n = await prisma.offerMatchAttempt.count({
    where: {
      offerId: orderId,
      workspaceId: { in: ids },
      status: { in: PRE_MATCH_INVITE_STATUSES },
    },
  });
  return n > 0;
}
