/**
 * Business (Workspace) API service layer.
 *
 * All endpoints are scoped under `/api/workspaces/:workspaceId`.
 * Uses the shared Axios instance from `../lib/api` which attaches auth tokens.
 */
import api from '../lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkspaceOverview {
  totalOrders: number
  pendingOrders: number
  completedOrders: number
  totalEarnings: number
  activeStaff: number
}

export interface OfferMatchAttempt {
  id: string
  providerId: string
  workspaceId: string
  status: string
  score: number
  distanceKm: number | null
  invitedAt: string
  matchedAt: string | null
  respondedAt: string | null
  expiresAt: string | null
  declineReason: string | null
  supersededAt: string | null
  lostReason: string | null
  lostFeedback: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  package: {
    id: string
    name: string
    description: string | null
    finalPrice: number
    currency: string
    bookingMode: string
    durationMinutes: number | null
    serviceCatalogId: string
    bom: Array<{
      quantity: number
      snapshotUnitPrice: number
      snapshotCurrency: string
      snapshotProductName: string
      snapshotUnit: string
      notes: string | null
    }>
  }
  order: {
    id: string
    customerId: string
    serviceCatalogId: string
    answers: Record<string, unknown>
    photos: Record<string, unknown>
    description: string
    address: string
    scheduledAt: string | null
    scheduleFlexibility: string
    phase: string | null
    status: string
    matchedProviderId: string | null
    matchedWorkspaceId: string | null
    locationLat: number | null
    locationLng: number | null
    submittedAt: string | null
    customerPicks: Record<string, unknown> | null
    contractSummary: { currentVersionStatus: string } | null
  }
  customer: {
    id: string
    email: string
    displayName: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    avatarUrl: string | null
  }
  serviceCatalog: {
    id: string
    name: string
    category: string
    slug: string
  }
}

export interface InboxResponse {
  total: number
  page: number
  pageSize: number
  items: OfferMatchAttempt[]
}

export interface WorkspaceFinance {
  transactions: Array<{
    id: string
    date: string
    serviceOrPackage: string
    client: string
    staff: string | null
    amount: number
    commission: number
    netAmount: number
    paymentReference: string | null
    status: string
  }>
  totals: {
    amount: number
    commission: number
    netAmount: number
  }
}

export interface WorkspaceClient {
  id: string
  email: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
  phone: string | null
  orderCount: number
  totalSpent: number
  createdAt: string
}

export interface ClientDetail {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  phone: string | null
  createdAt: string
  orders: Array<{
    id: string
    serviceCatalog: { id: string; name: string } | null
    invoice: { id: string; status: string; total: number; createdAt: Date } | null
    createdAt: Date
  }>
  totalSpent: number
}

export interface ScheduleEvent {
  id: string
  title: string
  start: string
  end: string
  clientName: string
  serviceName: string
  status: string
  staffName: string | null
}

export interface BusinessPost {
  id: string
  thumbnailUrl: string | null
  caption: string | null
  category: string | null
  likes: number
  comments: number
  createdAt: string
  archivedAt: string | null
  scheduledAt: string | null
}

export interface Invoice {
  id: string
  workspaceId: string
  customerId: string | null
  orderId: string | null
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED'
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  dueDate: string | null
  sentAt: string | null
  paidAt: string | null
  pdfUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInvoicePayload {
  customerId: string
  orderId?: string
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  tax?: number
  dueDate?: string
  notes?: string
}

export interface DashboardFilters {
  dateFrom?: string
  dateTo?: string
  serviceType?: string
  packageType?: string
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Fetch workspace overview / dashboard stats.
 * GET /api/workspaces/:id/dashboard/overview
 */
export async function getWorkspaceStats(
  workspaceId: string,
  _filters?: DashboardFilters
): Promise<WorkspaceOverview> {
  const { data } = await api.get<WorkspaceOverview>(
    `/workspaces/${workspaceId}/dashboard/overview`
  )
  return data
}

/**
 * Fetch inbox offers (match attempts).
 * GET /api/workspaces/:id/inbox?status=...&page=...&pageSize=...
 */
export async function getOffers(
  workspaceId: string,
  params?: {
    status?: string | string[]
    segment?: string
    page?: number
    pageSize?: number
  }
): Promise<InboxResponse> {
  const { data } = await api.get<InboxResponse>(
    `/workspaces/${workspaceId}/inbox`,
    { params }
  )
  return data
}

/**
 * Fetch a single offer/attempt detail.
 * GET /api/workspaces/:id/inbox/:attemptId
 */
export async function getOfferDetail(
  workspaceId: string,
  attemptId: string
): Promise<OfferMatchAttempt> {
  const { data } = await api.get<OfferMatchAttempt>(
    `/workspaces/${workspaceId}/inbox/${attemptId}`
  )
  return data
}

/**
 * Accept an offer (invited → accepted).
 * POST /api/workspaces/:id/inbox/:attemptId/accept
 */
export async function acceptOffer(
  workspaceId: string,
  attemptId: string
): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `/workspaces/${workspaceId}/inbox/${attemptId}/accept`
  )
  return data
}

/**
 * Acknowledge an offer (matched → accepted).
 * POST /api/workspaces/:id/inbox/:attemptId/acknowledge
 */
export async function acknowledgeOffer(
  workspaceId: string,
  attemptId: string
): Promise<{ success: boolean; orderId: string }> {
  const { data } = await api.post<{ success: boolean; orderId: string }>(
    `/workspaces/${workspaceId}/inbox/${attemptId}/acknowledge`
  )
  return data
}

/**
 * Decline an offer.
 * POST /api/workspaces/:id/inbox/:attemptId/decline
 */
export async function declineOffer(
  workspaceId: string,
  attemptId: string,
  reason: string
): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `/workspaces/${workspaceId}/inbox/${attemptId}/decline`,
    { reason }
  )
  return data
}

/**
 * Submit lost-deal feedback.
 * POST /api/workspaces/:id/inbox/:attemptId/lost-feedback
 */
export async function submitLostFeedback(
  workspaceId: string,
  attemptId: string,
  payload: {
    reasons: string[]
    otherText?: string
    providerComment?: string
  }
): Promise<Record<string, unknown>> {
  const { data } = await api.post<Record<string, unknown>>(
    `/workspaces/${workspaceId}/inbox/${attemptId}/lost-feedback`,
    payload
  )
  return data
}

/**
 * Fetch workspace schedule.
 * GET /api/workspaces/:id/schedule
 */
export async function getSchedule(
  workspaceId: string,
  params?: {
    staffId?: string
    dateFrom?: string
    dateTo?: string
  }
): Promise<ScheduleEvent[]> {
  const { data } = await api.get<ScheduleEvent[]>(
    `/workspaces/${workspaceId}/schedule`,
    { params }
  )
  return data
}

/**
 * Fetch workspace clients (CRM).
 * GET /api/workspaces/:id/crm/clients
 * Backend returns: { data: WorkspaceClient[], total, page, pageSize }
 */
export async function getClients(
  workspaceId: string,
  params?: {
    search?: string
    page?: number
    pageSize?: number
  }
): Promise<{ data: WorkspaceClient[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get<{
    data: WorkspaceClient[]
    total: number
    page: number
    pageSize: number
  }>(`/workspaces/${workspaceId}/crm/clients`, { params })
  return data
}

/**
 * Fetch single client detail.
 * GET /api/workspaces/:id/crm/clients/:clientId
 * Backend returns: { data: ClientDetail }
 */
export async function getClientDetail(
  workspaceId: string,
  clientId: string
): Promise<ClientDetail> {
  const { data } = await api.get<{ data: ClientDetail }>(
    `/workspaces/${workspaceId}/crm/clients/${clientId}`
  )
  return data.data
}

/**
 * Fetch workspace finance / transactions.
 * GET /api/workspaces/:id/finance
 */
export async function getFinance(
  workspaceId: string,
  params?: {
    dateFrom?: string
    dateTo?: string
    serviceType?: string
    clientName?: string
    staffName?: string
  }
): Promise<WorkspaceFinance> {
  const { data } = await api.get<WorkspaceFinance>(
    `/workspaces/${workspaceId}/finance`,
    { params }
  )
  return data
}

/**
 * Fetch invoices for a workspace.
 * GET /api/workspaces/:id/crm/invoices
 * Backend returns: { data: Invoice[], total, page, pageSize }
 */
export async function getInvoices(
  workspaceId: string,
  params?: {
    page?: number
    pageSize?: number
    status?: string
  }
): Promise<{ data: Invoice[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get<{
    data: Invoice[]
    total: number
    page: number
    pageSize: number
  }>(`/workspaces/${workspaceId}/crm/invoices`, { params })
  return data
}

/**
 * Create a new invoice.
 * POST /api/workspaces/:id/invoices
 */
export async function createInvoice(
  workspaceId: string,
  payload: CreateInvoicePayload
): Promise<Invoice> {
  const { data } = await api.post<Invoice>(
    `/workspaces/${workspaceId}/crm/invoices`,
    payload
  )
  return data
}

/**
 * Send an invoice to the client.
 * POST /api/workspaces/:id/invoices/:invoiceId/send
 */
export async function sendInvoice(
  workspaceId: string,
  invoiceId: string
): Promise<Invoice> {
  const { data } = await api.post<Invoice>(
    `/workspaces/${workspaceId}/crm/invoices/${invoiceId}/send`
  )
  return data
}

/**
 * Fetch business posts (social media manager).
 * GET /api/posts?workspaceId=... (public posts route)
 * Note: Workspace-scoped posts may use the general posts endpoint with workspaceId filter.
 */
export async function getBusinessPosts(
  workspaceId: string,
  params?: {
    page?: number
    pageSize?: number
    includeArchived?: boolean
  }
): Promise<{ data: BusinessPost[]; total: number; page: number; pageSize: number }> {
  const { data } = await api.get<{
    data: BusinessPost[]
    total: number
    page: number
    pageSize: number
  }>(`/posts`, { params: { ...params, workspaceId } })
  return data
}

/**
 * Create a business post.
 * POST /api/workspaces/:id/posts
 */
export async function createBusinessPost(
  workspaceId: string,
  payload: {
    caption?: string
    category?: string
    mediaUrl?: string
    scheduledAt?: string
  }
): Promise<BusinessPost> {
  const { data } = await api.post<BusinessPost>(
    `/posts`,
    { ...payload, workspaceId }
  )
  return data
}

/**
 * Archive a business post (soft-delete).
 * POST /api/workspaces/:id/posts/:postId/archive
 */
export async function archiveBusinessPost(
  _workspaceId: string,
  postId: string
): Promise<BusinessPost> {
  const { data } = await api.delete<BusinessPost>(
    `/posts/${postId}`
  )
  return data
}

/**
 * Update a business post caption or category.
 * PUT /api/workspaces/:id/posts/:postId
 */
export async function updateBusinessPost(
  _workspaceId: string,
  postId: string,
  payload: {
    caption?: string
    category?: string
  }
): Promise<BusinessPost> {
  const { data } = await api.put<BusinessPost>(
    `/posts/${postId}`,
    payload
  )
  return data
}
