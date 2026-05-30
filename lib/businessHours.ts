import prisma from './db.js';

/**
 * Validates whether a workspace is currently open for walk-in bookings.
 * Uses the BusinessHours model (dedicated table, ADR-0065).
 *
 * Returns { isOpen: boolean, reason?: string }
 */
export async function isWorkspaceOpenForWalkIn(
  workspaceId: string,
): Promise<{ isOpen: boolean; reason?: string }> {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sunday, 6=Saturday
  const currentTime = now.toISOString().slice(11, 16); // HH:mm in UTC

  const hours = await prisma.businessHours.findUnique({
    where: { workspaceId_dayOfWeek: { workspaceId, dayOfWeek } },
  });

  if (!hours) {
    // No hours configured → assume closed for walk-in
    return { isOpen: false, reason: 'Business hours not configured for this day' };
  }

  if (!hours.isOpen) {
    return { isOpen: false, reason: 'Business is closed on this day' };
  }

  if (currentTime < hours.openTime || currentTime >= hours.closeTime) {
    return {
      isOpen: false,
      reason: `Outside business hours (${hours.openTime} - ${hours.closeTime} UTC)`,
    };
  }

  return { isOpen: true };
}