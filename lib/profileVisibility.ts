import prisma from './db.js';

/**
 * Checks if there is a signed contract (order status >= 'contracted')
 * between a user and a provider workspace.
 */
export async function hasContractedOrderWithWorkspace(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  try {
    const count = await prisma.order.count({
      where: {
        customerId: userId,
        matchedWorkspaceId: workspaceId,
        status: {
          in: [
            'contracted',
            'paid',
            'in_progress',
            'completed',
            'disputed',
            'closed',
          ],
        },
      },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Checks if there is a signed contract (order status >= 'contracted')
 * between a user and a specific provider (by userId).
 */
export async function hasContractedOrder(
  userId: string,
  providerId: string,
): Promise<boolean> {
  try {
    const count = await prisma.order.count({
      where: {
        customerId: userId,
        matchedProviderId: providerId,
        status: {
          in: [
            'contracted',
            'paid',
            'in_progress',
            'completed',
            'disputed',
            'closed',
          ],
        },
      },
    });
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Checks if the requesting user is an admin (platform_admin or owner).
 */
export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  return ['platform_admin', 'owner', 'support', 'finance'].includes(role);
}

/**
 * Fields that are safe to expose publicly (without a contract).
 */
export const PUBLIC_COMPANY_FIELDS = [
  'id',
  'name',
  'slug',
  'slogan',
  'about',
  'logoUrl',
  'coverImageUrl',
  'type',
  'kycStatus',
  'location',
  'createdAt',
  'updatedAt',
] as const;

/**
 * Contact fields that should only be visible after a contract is signed.
 */
export const CONTACT_FIELDS = [
  'phone',
  'address',
  'website',
  'socialLinks',
] as const;
