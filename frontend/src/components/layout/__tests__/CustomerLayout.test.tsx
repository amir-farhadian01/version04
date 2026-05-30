import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { CustomerLayout } from '../CustomerLayout'

describe('CustomerLayout', () => {
  it('renders children via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/app/home']}>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/app/home" element={<div data-testid="child">Customer Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Customer Home')
  })

  it('renders the phone container wrapper with dark background', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/app/home']}>
        <Routes>
          <Route element={<CustomerLayout />}>
            <Route path="/app/home" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('bg-nh-bg')
    expect(outer.className).toContain('min-h-screen')
  })
})
