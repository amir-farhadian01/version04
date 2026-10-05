import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { saveDraftLocally } from '../../../services/orderDraft.js'
import OrderWizard from '../OrderWizard'

// /order/new without a serviceId used to dead-end on a step with nothing actionable.
// The wizard must redirect to the service discovery surface (/explore) instead, while
// a preselected service (?serviceId=…) keeps the wizard running.

function renderWizard(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/order/new${search}`]}>
      <Routes>
        <Route path="/order/new" element={<OrderWizard />} />
        <Route path="/explore" element={<div>EXPLORE_FALLBACK</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OrderWizard entry', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    localStorage.clear()
    globalThis.fetch = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({ id: 'svc-1', name: 'Test Service', price: 89 }),
      }) as Response,
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('redirects bare /order/new to /explore instead of dead-ending', async () => {
    renderWizard('')
    expect(await screen.findByText('EXPLORE_FALLBACK')).toBeDefined()
  })

  it('resumes the wizard when a service is preselected', async () => {
    renderWizard('?serviceId=svc-1')
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled()
      expect(screen.queryByText('EXPLORE_FALLBACK')).toBeNull()
    })
  })

  it('resumes the wizard from a saved draft that already has a selection', async () => {
    saveDraftLocally({
      step: 2,
      serviceId: 'svc-saved',
      updatedAt: new Date().toISOString(),
    } as Parameters<typeof saveDraftLocally>[0])
    renderWizard('')
    await waitFor(() => {
      expect(screen.queryByText('EXPLORE_FALLBACK')).toBeNull()
    })
  })
})