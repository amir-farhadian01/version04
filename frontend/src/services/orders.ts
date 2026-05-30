import api from '../lib/api'

// ── Order Detail types ──────────────────────────────────────────────────

export type OrderDetailData = {
  id: string;
  offerId: string;
  orderId: string;
  jobId: string | null;
  customerId: string;
  serviceCatalogId: string;
  description: string;
  descriptionAiAssisted: boolean;
  scheduledAt: string | null;
  scheduleFlexibility: string;
  address: string;
  locationLat: number | null;
  locationLng: number | null;
  entryPoint: string;
  urgency: string;
  status: OrderStatus;
  phase: OrderPhase | null;
  matchedPackageId: string | null;
  matchedProviderId: string | null;
  matchedWorkspaceId: string | null;
  assignedStaffId: string | null;
  assignedStaff: ProviderSummary | null;
  autoMatchExhausted: boolean;
  matchingExpiresAt: string | null;
  customerPicks: unknown;
  budget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schema: unknown;
  staleSnapshot: boolean;
  payment: {
    amount: number;
    status: string;
    escrowReleaseAt: string | null;
  } | null;
  matchedSummary: {
    provider: ProviderSummary;
    workspace: { id: string; name: string };
    package: { id: string; name: string; finalPrice: number; currency: string; durationMinutes?: number };
  } | null;
  customerReview: {
    rating: number;
    reviewText: string | null;
    createdAt: string;
  } | null;
  customerContract: {
    id: string;
    currentVersion: {
      id: string;
      status: string;
    } | null;
  } | null;
  offerTraceId?: string;
  orderTraceId?: string;
  jobTraceId?: string;
};

export const getOrders = () => api.get('/orders').then((r) => r.data)
export const getOrder = (id: string) => api.get(`/orders/${id}`).then((r) => r.data)
export const createOrder = (payload: unknown) => api.post('/orders', payload).then((r) => r.data)

// ── My Orders pipeline types ──────────────────────────────────────────────

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'matching'
  | 'matched'
  | 'contracted'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'closed'
  | 'cancelled'

export type OrderPhase = 'offer' | 'order' | 'job'

export type OrderReview = {
  rating: number
  reviewText: string | null
  createdAt: string
}

export type ProviderSummary = {
  id: string
  displayName: string | null
  firstName?: string | null
  lastName?: string | null
  avatarUrl?: string | null
}

export type OrderListItem = {
  id: string
  status: OrderStatus
  phase: OrderPhase | null
  createdAt: string
  updatedAt: string
  urgency: string
  budget: number | null
  serviceCatalog: {
    id: string
    name: string
    breadcrumb: { id: string; name: string; parentId: string | null }[]
  }
  matchedProviderId: string | null
  matchedSummary?: {
    provider: ProviderSummary
    workspace: { id: string; name: string }
    package: { id: string; name: string; finalPrice: number; currency: string }
  } | null
  payment: {
    amount: number
    status: string
    escrowReleaseAt: string | null
  } | null
  review: OrderReview | null
}

export type PhaseFacetCounts = {
  offer: number
  order: number
  job: number
  cancelledOffer: number
  cancelledOrder: number
  cancelledJob: number
}

export type MyOrdersResponse = {
  items: OrderListItem[]
  total: number
  page: number
  pageSize: number
  facets?: { phase: PhaseFacetCounts }
}

export type MyOrdersParams = {
  phase?: string
  page?: number
  pageSize?: number
}

export async function getMyOrders(params: MyOrdersParams = {}): Promise<MyOrdersResponse> {
  const res = await api.get<MyOrdersResponse>('/orders/me', { params })
  return res.data
}

export async function cancelOrder(orderId: string, reason: string): Promise<void> {
  await api.post(`/orders/${orderId}/cancel`, { reason })
}
