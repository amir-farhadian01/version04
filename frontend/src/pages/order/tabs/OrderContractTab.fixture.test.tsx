import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import OrderContractTab from './OrderContractTab.js'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), approve: vi.fn(), reject: vi.fn() }))
vi.mock('../../../services/orderContracts.js', () => ({ fetchContractBundle: mocks.fetch, approveContract: mocks.approve, rejectContract: mocks.reject }))

afterEach(() => { mocks.fetch.mockReset(); mocks.approve.mockReset(); mocks.reject.mockReset() })

it('approves the sent contract from an isolated fixture', async () => {
  mocks.fetch.mockResolvedValue({ contract: { id: 'contract-fixture', orderId: 'order-fixture', currentVersionId: 'version-fixture', currentVersion: { id: 'version-fixture', versionNumber: 1, status: 'sent', title: 'Fixture agreement', termsMarkdown: 'Fixture terms', policiesMarkdown: null, scopeSummary: 'Fixture scope', amount: 4200, currency: 'CAD', sentAt: null, reviewedAt: null, reviewNote: null, createdAt: '2026-11-25T00:00:00.000Z' } }, versions: [{ id: 'version-fixture', versionNumber: 1, status: 'sent', title: 'Fixture agreement', termsMarkdown: 'Fixture terms', policiesMarkdown: null, scopeSummary: 'Fixture scope', amount: 4200, currency: 'CAD', sentAt: null, reviewedAt: null, reviewNote: null, createdAt: '2026-11-25T00:00:00.000Z' }], events: [] })
  mocks.approve.mockResolvedValue({ id: 'version-fixture', status: 'approved' })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><OrderContractTab orderId="order-fixture" order={{ id: 'order-fixture', status: 'contracted' } as never} /></QueryClientProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Approve' }))
  await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith('order-fixture', 'version-fixture'))
  expect(await screen.findByText('Contract approved.')).toBeTruthy()
})
