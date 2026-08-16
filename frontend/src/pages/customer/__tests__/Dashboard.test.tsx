import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { MyOrdersResponse, OrderListItem } from '../../../services/orders'
import CustomerDashboard from '../Dashboard'

// ── Mock the orders service ──────────────────────────────────────────────────

const mockGetMyOrders = vi.hoisted(() => vi.fn())

vi.mock('../../../services/orders', () => ({
  getMyOrders: mockGetMyOrders,
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockOrder(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'order-1',
    status: 'submitted',
    phase: 'order',
    createdAt: '2026-05-01T12:00:00Z',
    updatedAt: new Date().toISOString(),
    urgency: 'standard',
    budget: null,
    serviceCatalog: {
      id: 'cat-1',
      name: 'Plumbing Repair',
      breadcrumb: [{ id: 'cat-1', name: 'Plumbing', parentId: null }],
    },
    matchedProviderId: null,
    matchedSummary: null,
    payment: null,
    review: null,
    ...overrides,
  }
}

function createMockResponse(items: OrderListItem[]): MyOrdersResponse {
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: 20,
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  mockGetMyOrders.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function renderDashboard() {
  return render(
    <MemoryRouter>
      <CustomerDashboard />
    </MemoryRouter>
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerDashboard', () => {
  it('renders loading state initially', () => {
    mockGetMyOrders.mockReturnValue(new Promise(() => {}))

    renderDashboard()

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('renders orders after successful fetch', async () => {
    const orders = [
      createMockOrder({
        id: '1',
        status: 'submitted',
        serviceCatalog: { id: 'cat-1', name: 'Plumbing Repair', breadcrumb: [] },
      }),
      createMockOrder({
        id: '2',
        status: 'in_progress',
        serviceCatalog: { id: 'cat-2', name: 'Electrical Work', breadcrumb: [] },
      }),
    ]
    mockGetMyOrders.mockResolvedValue(createMockResponse(orders))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Plumbing Repair')).toBeInTheDocument()
    })

    expect(screen.getByText('Electrical Work')).toBeInTheDocument()
    expect(screen.getByText('Active Orders (2)')).toBeInTheDocument()
  })

  it('shows empty state when no orders', async () => {
    mockGetMyOrders.mockResolvedValue(createMockResponse([]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No orders yet')).toBeInTheDocument()
    })

    expect(screen.getByText('Explore Services')).toBeInTheDocument()
  })

  it('shows error state on fetch failure', async () => {
    mockGetMyOrders.mockRejectedValue(new Error('Network error'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Failed to load orders')).toBeInTheDocument()
    })

    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('separates active and past orders', async () => {
    const orders = [
      createMockOrder({ id: '1', status: 'submitted' }),
      createMockOrder({ id: '2', status: 'completed' }),
      createMockOrder({ id: '3', status: 'in_progress' }),
      createMockOrder({ id: '4', status: 'cancelled' }),
    ]
    mockGetMyOrders.mockResolvedValue(createMockResponse(orders))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Active Orders (2)')).toBeInTheDocument()
    })

    expect(screen.getByText('Past Orders (2)')).toBeInTheDocument()
  })

  it('polls for updates every 10 seconds', async () => {
    mockGetMyOrders.mockResolvedValue(createMockResponse([]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('No orders yet')).toBeInTheDocument()
    })

    expect(mockGetMyOrders).toHaveBeenCalledTimes(1)

    // Advance 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockGetMyOrders).toHaveBeenCalledTimes(2)

    // Advance another 10 seconds
    await act(async () => {
      vi.advanceTimersByTime(10000)
    })

    expect(mockGetMyOrders).toHaveBeenCalledTimes(3)
  })

  it('displays matched provider info when available', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'in_progress',
      matchedSummary: {
        provider: { id: 'p1', displayName: 'Mike R.' },
        workspace: { id: 'w1', name: "Mike's Plumbing" },
        package: { id: 'pkg1', name: 'Standard Fix', finalPrice: 149, currency: 'USD' },
      },
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText((content) => content.includes("Mike's Plumbing"))).toBeInTheDocument()
    })
  })

  it('displays status badge with correct label and color', async () => {
    const order = createMockOrder({ id: '1', status: 'in_progress' })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('In Progress')).toBeInTheDocument()
    })

    const badge = screen.getByText('In Progress')
    expect(badge.className).toContain('bg-cyan-500/20')
    expect(badge.className).toContain('text-cyan-300')
  })

  // ── New F1 Tests ──────────────────────────────────────────────────────────

  it('displays phase label in Persian for active orders', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'matching',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Finding provider')).toBeInTheDocument()
    })
  })

  it('shows progress bar with percentage text for active orders', async () => {
    // Use a status with non-zero duration so percentage is computed
    const order = createMockOrder({
      id: '1',
      status: 'matching',
      updatedAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago (6.67% of 15 min)
      urgency: 'standard',
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/% completed/)).toBeInTheDocument()
    })
  })

  it('shows remaining time text for active orders', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'matching',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/remaining/)).toBeInTheDocument()
    })
  })

  it('displays payment info when payment is available', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'paid',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
      payment: {
        amount: 5000, // $50.00 in cents
        status: 'CAPTURED',
        escrowReleaseAt: '2026-06-01T00:00:00Z',
      },
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('$50.00')).toBeInTheDocument()
    })

    expect(screen.getByText('CAPTURED')).toBeInTheDocument()
  })

  it('does not show progress bar or phase label for past/terminal orders', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'completed',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Past Orders (1)')).toBeInTheDocument()
    })

    // Phase label should NOT appear for completed orders
    expect(screen.queryByText('تکمیل شده')).not.toBeInTheDocument()
    // Progress bar should NOT appear
    expect(screen.queryByText(/% completed/)).not.toBeInTheDocument()
    // Remaining time should NOT appear
    expect(screen.queryByText(/remaining/)).not.toBeInTheDocument()
  })

  it('shows payment status with correct color class', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'paid',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
      payment: {
        amount: 10000,
        status: 'CAPTURED',
        escrowReleaseAt: null,
      },
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('CAPTURED')).toBeInTheDocument()
    })

    const paymentBadge = screen.getByText('CAPTURED')
    expect(paymentBadge.className).toContain('bg-nh-success/20')
    expect(paymentBadge.className).toContain('text-nh-success')
  })

  it('shows escrow release date when set', async () => {
    const order = createMockOrder({
      id: '1',
      status: 'paid',
      updatedAt: new Date().toISOString(),
      urgency: 'standard',
      payment: {
        amount: 7500,
        status: 'CAPTURED',
        escrowReleaseAt: '2026-06-15T00:00:00Z',
      },
    })
    mockGetMyOrders.mockResolvedValue(createMockResponse([order]))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText(/Escrow release/)).toBeInTheDocument()
    })
  })
})
