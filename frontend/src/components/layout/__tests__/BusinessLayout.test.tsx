import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { BusinessLayout } from '../BusinessLayout'

describe('BusinessLayout', () => {
  it('renders children via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/business/workspace-1']}>
        <Routes>
          <Route path="/business/:workspaceId" element={<BusinessLayout />}>
            <Route index element={<div data-testid="child">Business Dashboard</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Business Dashboard')
  })

  it('renders the phone container wrapper with dark background', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/business/workspace-1']}>
        <Routes>
          <Route path="/business/:workspaceId" element={<BusinessLayout />}>
            <Route index element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('bg-nh-bg')
    expect(outer.className).toContain('min-h-screen')
  })
})
