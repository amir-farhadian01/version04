import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import OrderDetail from '../OrderDetail.js'

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), currentUser: { id: 'customer-1' } as { id: string } | null,
}))
vi.mock('../../../lib/api.js', () => ({ default: { get: mocks.get, post: mocks.post } }))
vi.mock('../../../store/authStore.js', () => ({ useAuthStore: (selector: (state: { user: typeof mocks.currentUser }) => unknown) => selector({ user: mocks.currentUser }) }))
vi.mock('../tabs/OrderDetailsTab.js', () => ({ default: () => <div>details</div> }))
vi.mock('../tabs/OrderContractTab.js', () => ({ default: () => <div>contract</div> }))
vi.mock('../tabs/OrderChatTab.js', () => ({ default: () => <div>chat</div> }))

const matchingOrder = { id: 'order-1', offerId: 'offer-1', orderId: 'order-1', jobId: null, customerId: 'customer-1', serviceCatalogId: 'catalog-1', description: 'Fixture request', descriptionAiAssisted: false, scheduledAt: null, scheduleFlexibility: 'flexible', address: 'Fixture address', locationLat: null, locationLng: null, entryPoint: 'web', urgency: 'normal', status: 'matching', phase: 'offer', matchedPackageId: null, matchedProviderId: null, matchedWorkspaceId: null, assignedStaffId: null, assignedStaff: null, autoMatchExhausted: false, matchingExpiresAt: null, customerPicks: null, budget: null, budgetMin: null, budgetMax: null, cancelReason: null, cancelledAt: null, submittedAt: null, createdAt: '2026-11-23T00:00:00.000Z', updatedAt: '2026-11-23T00:00:00.000Z', schema: null, staleSnapshot: false, payment: null, matchedSummary: null, customerReview: null, customerContract: null }

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/app/orders/order-1']}><Routes><Route path="/app/orders/:id" element={<OrderDetail />} /></Routes></MemoryRouter></QueryClientProvider>)
}

afterEach(() => { mocks.currentUser = { id: 'customer-1' }; mocks.get.mockReset(); mocks.post.mockReset() })

it('uses the isolated offer fixture to select the exact accepted provider attempt', async () => {
  mocks.get.mockImplementation((url: string) => {
    if (url === '/orders/order-1') return Promise.resolve({ data: matchingOrder })
    if (url === '/orders/order-1/candidates') return Promise.resolve({ data: { candidates: [{ attemptId: 'attempt-1', providerName: 'Fixture Provider', workspaceName: 'Fixture Workspace', packageName: 'Fixture Package', packageFinalPrice: 42, packageCurrency: 'CAD' }] } })
    throw new Error(`Unexpected GET ${url}`)
  })
  mocks.post.mockResolvedValue({ data: {} })
  renderDetail()
  fireEvent.click(await screen.findByRole('button', { name: 'Select Provider' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/orders/order-1/select-provider', { attemptId: 'attempt-1' }))
  expect(mocks.get).toHaveBeenCalledWith('/orders/order-1')
})

it('does not request or reveal fixture offers for another customer', async () => {
  mocks.currentUser = { id: 'other-customer' }
  mocks.get.mockResolvedValue({ data: matchingOrder })
  renderDetail()
  await screen.findByText('Matching')
  expect(screen.queryByText('Provider offers')).not.toBeInTheDocument()
  expect(mocks.get).not.toHaveBeenCalledWith('/orders/order-1/candidates')
})
