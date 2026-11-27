import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import ReviewStep from './ReviewStep.js'

const mocks = vi.hoisted(() => ({ saveDraftToApi: vi.fn(), clearDraft: vi.fn(), get: vi.fn(), post: vi.fn() }))
vi.mock('../../../services/orderDraft.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../../services/orderDraft.js')>()), saveDraftToApi: mocks.saveDraftToApi, clearDraft: mocks.clearDraft }))
vi.mock('../../../store/authStore.js', () => ({ useAuthStore: (selector: (state: { token: string }) => unknown) => selector({ token: 'fixture-token' }) }))
vi.mock('../../../lib/api.js', () => ({ default: { get: mocks.get, post: mocks.post } }))

afterEach(() => { mocks.saveDraftToApi.mockReset(); mocks.clearDraft.mockReset(); mocks.get.mockReset(); mocks.post.mockReset() })

it('submits an isolated order fixture and continues to its detail page', async () => {
  mocks.saveDraftToApi.mockResolvedValue('draft-fixture')
  mocks.get.mockResolvedValue({ data: { schema: { fields: [] } } })
  mocks.post.mockResolvedValue({ data: { id: 'order-fixture' } })
  render(
    <MemoryRouter initialEntries={['/order/new']}>
      <Routes>
        <Route
          path="/order/new"
          element={<ReviewStep draft={{ step: 4, serviceId: 'service-fixture', description: 'A sufficiently detailed fixture order request.', address: '100 Fixture Street', scheduledDate: '2030-01-01T10:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z' }} onUpdate={() => {}} onBack={() => {}} />}
        />
        <Route path="/app/orders/:id" element={<h1>Fixture order detail</h1>} />
      </Routes>
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Submit Order' }))
  await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/orders/draft/draft-fixture/submit', expect.any(Object)))
  expect(await screen.findByText('Order created successfully! Redirecting...')).toBeTruthy()
  expect(await screen.findByRole('heading', { name: 'Fixture order detail' }, { timeout: 2500 })).toBeTruthy()
})
