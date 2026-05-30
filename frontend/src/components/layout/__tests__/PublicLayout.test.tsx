import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import { PublicLayout } from '../PublicLayout'

describe('PublicLayout', () => {
  it('renders children via Outlet', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div data-testid="child">Hello Public</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Hello Public')
  })

  it('renders the phone container wrapper', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    // The outer wrapper should have the dark background
    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('bg-nh-bg')
    expect(outer.className).toContain('font-sans')
  })

  it('has correct min-height for full viewport', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    const outer = container.firstChild as HTMLElement
    expect(outer.className).toContain('min-h-screen')
  })
})
