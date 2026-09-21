import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BusinessDashboard from '../BusinessDashboard.js'
import StaffManagement from '../StaffManagement.js'

const get = vi.hoisted(() => vi.fn())
vi.mock('../../../lib/api', () => ({ default: { get } }))

beforeEach(() => get.mockReset())

describe('Business dashboard workspace selection', () => {
  function open() {
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<BusinessDashboard />} />
      <Route path="/business/:workspaceId" element={<>Selected workspace</>} />
    </Routes></MemoryRouter>)
  }

  it('loads authorized workspaces and lets the user open one without requesting an undefined dashboard', async () => {
    get.mockResolvedValue({ data: [{ id: 'business-1', name: 'Local Business' }] })
    open()
    fireEvent.click(await screen.findByRole('link', { name: 'Local Business' }))
    expect(screen.getByText('Selected workspace')).toBeInTheDocument()
    expect(get).toHaveBeenCalledExactlyOnceWith('/workspaces/me')
  })

  it('provides an actionable empty state when no business is linked', async () => {
    get.mockResolvedValue({ data: [] })
    open()
    expect(await screen.findByText(/No business workspace is linked/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('recovers from a workspace lookup failure through Retry', async () => {
    get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [{ id: 'business-1', name: 'Recovered Business' }] })
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('link', { name: 'Recovered Business' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('still loads the dashboard overview when a workspace is specified', async () => {
    get.mockResolvedValue({ data: { activeOrders: 0, pendingQuotes: 0, todayAppointments: 0, revenueThisMonth: 0, upcomingAppointments: [], recentOrders: [], staff: [], pipeline: [], topCustomers: [], recentActivity: [] } })
    render(<MemoryRouter initialEntries={['/business/business-1']}><Routes>
      <Route path="/business/:workspaceId" element={<BusinessDashboard />} />
    </Routes></MemoryRouter>)
    expect(await screen.findByText('Revenue This Month')).toBeInTheDocument()
    expect(get).toHaveBeenCalledExactlyOnceWith('/workspaces/business-1/dashboard/overview')
  })
})

it('reloads the staff directory after a failed request without retaining the error', async () => {
  get.mockRejectedValueOnce({ response: { data: { error: 'Temporarily unavailable' } } }).mockResolvedValueOnce({ data: { staff: [] } })
  render(<MemoryRouter initialEntries={['/business/business-1/staff']}><Routes>
    <Route path="/business/:workspaceId/staff" element={<StaffManagement />} />
  </Routes></MemoryRouter>)
  expect(await screen.findByRole('alert')).toHaveTextContent('Temporarily unavailable')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('Staff Directory')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
  expect(get).toHaveBeenLastCalledWith('/staff/business-1')
})
