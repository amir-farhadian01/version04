import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getWorkspaceStats,
  getOffers,
  getOfferDetail,
  acceptOffer,
  acknowledgeOffer,
  declineOffer,
  submitLostFeedback,
  getSchedule,
  getClients,
  getClientDetail,
  getFinance,
  getInvoices,
  createInvoice,
  sendInvoice,
  getBusinessPosts,
  createBusinessPost,
  archiveBusinessPost,
  updateBusinessPost,
} from '../business'
import api from '../../lib/api'

vi.mock('../../lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

const WORKSPACE_ID = 'ws-1'

describe('business service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getWorkspaceStats', () => {
    it('calls GET /workspaces/:id/dashboard/overview and returns data', async () => {
      const mockStats = {
        totalOrders: 100,
        pendingOrders: 20,
        completedOrders: 70,
        totalEarnings: 50000,
        activeStaff: 5,
      }
      vi.mocked(api.get).mockResolvedValue({ data: mockStats })

      const result = await getWorkspaceStats(WORKSPACE_ID)
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/dashboard/overview`)
      expect(result).toEqual(mockStats)
    })
  })

  describe('getOffers', () => {
    it('calls GET /workspaces/:id/inbox with query params', async () => {
      const mockResponse = {
        total: 10,
        page: 1,
        pageSize: 10,
        items: [{ id: 'offer-1', status: 'invited' }],
      }
      vi.mocked(api.get).mockResolvedValue({ data: mockResponse })

      const result = await getOffers(WORKSPACE_ID, { status: 'invited', page: 1, pageSize: 10 })
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/inbox`, {
        params: { status: 'invited', page: 1, pageSize: 10 },
      })
      expect(result).toEqual(mockResponse)
    })

    it('omits undefined params', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: { total: 0, page: 1, pageSize: 10, items: [] } })

      await getOffers(WORKSPACE_ID, { page: 1, pageSize: 10 })
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/inbox`, {
        params: { page: 1, pageSize: 10 },
      })
    })
  })

  describe('getOfferDetail', () => {
    it('calls GET /workspaces/:id/inbox/:attemptId', async () => {
      const mockDetail = { id: 'attempt-1', status: 'invited' }
      vi.mocked(api.get).mockResolvedValue({ data: mockDetail })

      const result = await getOfferDetail(WORKSPACE_ID, 'attempt-1')
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/inbox/attempt-1`)
      expect(result).toEqual(mockDetail)
    })
  })

  describe('acceptOffer', () => {
    it('calls POST /workspaces/:id/inbox/:attemptId/accept', async () => {
      const mockResponse = { id: 'attempt-1', status: 'accepted' }
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse })

      const result = await acceptOffer(WORKSPACE_ID, 'attempt-1')
      expect(api.post).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/inbox/attempt-1/accept`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('acknowledgeOffer', () => {
    it('calls POST /workspaces/:id/inbox/:attemptId/acknowledge', async () => {
      const mockResponse = { id: 'attempt-1', status: 'acknowledged' }
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse })

      const result = await acknowledgeOffer(WORKSPACE_ID, 'attempt-1')
      expect(api.post).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/inbox/attempt-1/acknowledge`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('declineOffer', () => {
    it('calls POST /workspaces/:id/inbox/:attemptId/decline with reason', async () => {
      const mockResponse = { id: 'attempt-1', status: 'declined' }
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse })

      const result = await declineOffer(WORKSPACE_ID, 'attempt-1', 'Not available')
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/inbox/attempt-1/decline`,
        { reason: 'Not available' },
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('submitLostFeedback', () => {
    it('calls POST /workspaces/:id/inbox/:attemptId/lost-feedback with reasons', async () => {
      const mockResponse = { id: 'attempt-1', status: 'lost' }
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse })

      const result = await submitLostFeedback(WORKSPACE_ID, 'attempt-1', {
        reasons: ['price'],
        providerComment: 'Too expensive',
      })
      expect(api.post).toHaveBeenCalledWith(
        `/workspaces/${WORKSPACE_ID}/inbox/attempt-1/lost-feedback`,
        { reasons: ['price'], providerComment: 'Too expensive' },
      )
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getSchedule', () => {
    it('calls GET /workspaces/:id/schedule with date range', async () => {
      const mockEvents = [{ id: 'evt-1', title: 'Cleaning Job' }]
      vi.mocked(api.get).mockResolvedValue({ data: mockEvents })

      const result = await getSchedule(WORKSPACE_ID, {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-31',
      })
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/schedule`, {
        params: { dateFrom: '2026-05-01', dateTo: '2026-05-31' },
      })
      expect(result).toEqual(mockEvents)
    })
  })

  describe('getClients', () => {
    it('calls GET /workspaces/:id/crm/clients with params', async () => {
      const mockResponse = {
        data: [{ id: 'c-1', name: 'John' }],
        total: 1,
        page: 1,
        pageSize: 10,
      }
      vi.mocked(api.get).mockResolvedValue({ data: mockResponse })

      const result = await getClients(WORKSPACE_ID, { search: 'John', page: 1, pageSize: 10 })
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/crm/clients`, {
        params: { search: 'John', page: 1, pageSize: 10 },
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getClientDetail', () => {
    it('calls GET /workspaces/:id/crm/clients/:customerId', async () => {
      const backendResponse = {
        data: {
          id: 'c-1',
          name: 'John',
          orders: [],
          totalSpent: 10000,
        },
      }
      vi.mocked(api.get).mockResolvedValue({ data: backendResponse })

      const result = await getClientDetail(WORKSPACE_ID, 'c-1')
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/crm/clients/c-1`)
      // Service unwraps the backend { data: ... } wrapper
      expect(result).toEqual(backendResponse.data)
    })
  })

  describe('getFinance', () => {
    it('calls GET /workspaces/:id/finance', async () => {
      const mockFinance = {
        totalRevenue: 50000,
        pendingPayouts: 10000,
        transactions: [],
      }
      vi.mocked(api.get).mockResolvedValue({ data: mockFinance })

      const result = await getFinance(WORKSPACE_ID)
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/finance`, { params: undefined })
      expect(result).toEqual(mockFinance)
    })
  })

  describe('getInvoices', () => {
    it('calls GET /workspaces/:id/crm/invoices with params', async () => {
      const mockResponse = {
        data: [{ id: 'inv-1', status: 'pending' }],
        total: 1,
        page: 1,
        pageSize: 10,
      }
      vi.mocked(api.get).mockResolvedValue({ data: mockResponse })

      const result = await getInvoices(WORKSPACE_ID, { page: 1, pageSize: 10 })
      expect(api.get).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/crm/invoices`, {
        params: { page: 1, pageSize: 10 },
      })
      expect(result).toEqual(mockResponse)
    })
  })

  describe('createInvoice', () => {
    it('calls POST /workspaces/:id/crm/invoices with payload', async () => {
      const payload = {
        customerId: 'c-1',
        lineItems: [{ description: 'Cleaning', quantity: 1, unitPrice: 10000 }],
        dueDate: '2026-06-01',
      }
      const mockInvoice = { id: 'inv-1', ...payload }
      vi.mocked(api.post).mockResolvedValue({ data: mockInvoice })

      const result = await createInvoice(WORKSPACE_ID, payload)
      expect(api.post).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/crm/invoices`, payload)
      expect(result).toEqual(mockInvoice)
    })
  })

  describe('sendInvoice', () => {
    it('calls POST /workspaces/:id/crm/invoices/:invoiceId/send', async () => {
      const mockResponse = { id: 'inv-1', status: 'sent' }
      vi.mocked(api.post).mockResolvedValue({ data: mockResponse })

      const result = await sendInvoice(WORKSPACE_ID, 'inv-1')
      expect(api.post).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/crm/invoices/inv-1/send`)
      expect(result).toEqual(mockResponse)
    })
  })

  describe('getBusinessPosts', () => {
    it('calls GET /posts with workspaceId param', async () => {
      const mockPosts = [{ id: 'post-1', caption: 'Hello' }]
      vi.mocked(api.get).mockResolvedValue({ data: mockPosts })

      const result = await getBusinessPosts(WORKSPACE_ID)
      expect(api.get).toHaveBeenCalledWith('/posts', {
        params: { workspaceId: WORKSPACE_ID },
      })
      expect(result).toEqual(mockPosts)
    })
  })

  describe('createBusinessPost', () => {
    it('calls POST /posts with payload', async () => {
      const payload = {
        caption: 'New post',
        category: 'promotion',
      }
      const expectedPayload = { ...payload, workspaceId: WORKSPACE_ID }
      const mockPost = { id: 'post-1', ...expectedPayload }
      vi.mocked(api.post).mockResolvedValue({ data: mockPost })

      const result = await createBusinessPost(WORKSPACE_ID, payload)
      expect(api.post).toHaveBeenCalledWith('/posts', expectedPayload)
      expect(result).toEqual(mockPost)
    })
  })

  describe('archiveBusinessPost', () => {
    it('calls DELETE /posts/:postId', async () => {
      const mockPost = { id: 'post-1', archivedAt: new Date().toISOString() }
      vi.mocked(api.delete).mockResolvedValue({ data: mockPost })

      const result = await archiveBusinessPost(WORKSPACE_ID, 'post-1')
      expect(api.delete).toHaveBeenCalledWith('/posts/post-1')
      expect(result).toEqual(mockPost)
    })
  })

  describe('updateBusinessPost', () => {
    it('calls PUT /posts/:postId with payload', async () => {
      const payload = { caption: 'Updated caption' }
      const mockPost = { id: 'post-1', ...payload }
      vi.mocked(api.put).mockResolvedValue({ data: mockPost })

      const result = await updateBusinessPost(WORKSPACE_ID, 'post-1', payload)
      expect(api.put).toHaveBeenCalledWith('/posts/post-1', payload)
      expect(result).toEqual(mockPost)
    })
  })
})
