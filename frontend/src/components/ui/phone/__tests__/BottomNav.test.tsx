import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BottomNav, NavIcons } from '../BottomNav'
import { useAuthStore } from '../../../../store/authStore'

// Mock the auth store
vi.mock('../../../../store/authStore', () => ({
  useAuthStore: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const defaultItems = [
  { id: 'home', label: 'Home', icon: NavIcons.home, active: true },
  { id: 'social', label: 'Social', icon: NavIcons.social },
  { id: 'activity', label: 'Activity', icon: NavIcons.activity },
  { id: 'biz', label: 'Business', icon: NavIcons.business },
]

describe('BottomNav', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { roles: ['CUSTOMER'] },
    })
  })

  it('renders all nav items', () => {
    render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Social')).toBeInTheDocument()
    expect(screen.getByText('Activity')).toBeInTheDocument()
  })

  it('navigates to home on home click', () => {
    render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Home'))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })

  it('navigates to social on social click', () => {
    render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Social'))
    expect(mockNavigate).toHaveBeenCalledWith('/explorer')
  })

  it('hides business items for non-business roles', () => {
    render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    expect(screen.queryByText('Business')).not.toBeInTheDocument()
  })

  it('shows business items for business roles', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { roles: ['provider'], companyId: 'company-1' },
    })

    render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    expect(screen.getByText('Business')).toBeInTheDocument()
  })

  it('navigates to business dashboard with companyId', () => {
    (useAuthStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { roles: ['provider'], companyId: 'company-1' },
    })

    render(
      <MemoryRouter>
        <BottomNav items={[{ id: 'biz', label: 'Business', icon: NavIcons.business, isBiz: true }]} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Business'))
    expect(mockNavigate).toHaveBeenCalledWith('/business/company-1')
  })

  it('calls onClick handler when provided', () => {
    const handleClick = vi.fn()
    render(
      <MemoryRouter>
        <BottomNav items={[{ id: 'custom', label: 'Custom', icon: NavIcons.home, onClick: handleClick }]} />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Custom'))
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('has dark theme styling with NeighborHub tokens', () => {
    const { container } = render(
      <MemoryRouter>
        <BottomNav items={defaultItems} />
      </MemoryRouter>
    )

    const nav = container.firstChild as HTMLElement
    expect(nav.className).toContain('px-10')
    expect(nav.className).toContain('pb-6')
  })
})
