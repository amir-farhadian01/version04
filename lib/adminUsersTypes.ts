/**
 * Shared types for admin user grid — dependency-free, safe for backend + Vite frontend (`@/lib/...`).
 */

export const SEGMENT_STAFF_ROLES = [
  'owner',
  'platform_admin',
  'developer',
  'support',
  'finance',
  'staff',
] as const;

export const SEGMENT_ROLES = {
  all: null as readonly string[] | null,
  clients: ['customer'] as const,
  providers: ['provider'] as const,
  staff: [...SEGMENT_STAFF_ROLES] as readonly string[],
} as const;

export type AdminSegment = keyof typeof SEGMENT_ROLES;

export type KycSubStatus = 'pending' | 'verified' | 'rejected' | null;

export type AdminUserRowKyc = {
  personalStatus: KycSubStatus;
  businessStatus: KycSubStatus;
};

export type AdminUserRow = {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  staffRole: string | null;
  status: string;
  isVerified: boolean;
  mfaEnabled: boolean;
  gender: string | null;
  address: string | null;
  location: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  lastDevice: string | null;
  lastIp: string | null;
  registrationIp: string | null;
  birthDate: string | null;
  kyc: AdminUserRowKyc;
  ownedCompany: { id: string; name: string; kycStatus?: string } | null;
  memberships: Array<{ companyId: string; companyName: string; role: string }>;
  counts: {
    requestsAsCustomer: number;
    requestsAsProvider: number;
    /** Total contracts (customer + provider). */
    contracts: number;
    contractsAsCustomer: number;
    contractsAsProvider: number;
    services: number;
  };
  /** Avg of `Service.rating` for this user as provider; null if none. */
  avgServiceRating?: number | null;
  /** Max `Request.createdAt` where user is customer. */
  lastCustomerRequestAt?: string | null;
  /** Sum of `Contract.amount` where user is customer. */
  customerContractsValue?: number | null;
  /** From owned company, when present. */
  ownedCompanyKycStatus?: string | null;
};

export type AdminUsersFacets = {
  role: Record<string, number>;
  status: Record<string, number>;
  kycStatus: Record<string, number>;
  gender: Record<string, number>;
};

export type AdminUsersResponse = {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
  facets: AdminUsersFacets;
};

export type AdminUsersQuery = {
  page?: string | number;
  pageSize?: string | number;
  sortBy?: string;
  sortDir?: string;
  q?: string;
  segment?: string;
  role?: string | string[];
  'role[]'?: string | string[];
  status?: string | string[];
  'status[]'?: string | string[];
  isVerified?: string;
  kycStatus?: string | string[];
  'kycStatus[]'?: string | string[];
  kycPersonal?: string | string[];
  'kycPersonal[]'?: string | string[];
  kycBusiness?: string | string[];
  'kycBusiness[]'?: string | string[];
  gender?: string | string[];
  'gender[]'?: string | string[];
  companyId?: string;
  createdFrom?: string;
  createdTo?: string;
  lastLoginFrom?: string;
  lastLoginTo?: string;
};
