import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import BusinessPage from './BusinessPage'

const get = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api.js', () => ({ default: { get } }))

const profile = {
  company: { id: 'business-1', name: 'North Star Repairs', slug: 'north-star', slogan: 'Reliable local repairs', about: null, logoUrl: null, coverImageUrl: null, address: 'Toronto', phone: null, website: null, type: 'SERVICE', kycStatus: 'APPROVED', location: null },
  trust: { licenseNumber: null, licenseVerified: false, hasLiabilityInsurance: false, insuranceVerified: false, experienceYears: null, avgRating: 0, totalScore: 0, kycVerified: false },
  portfolio: { history: null, mission: null, galleryUrls: [], businessHours: null, tags: [] },
  stats: { totalServices: 0, totalStaff: 0, totalReviews: 0, totalOrders: 0 },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/biz/business-1']}>
      <Routes><Route path="/biz/:id" element={<BusinessPage />} /></Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

it('renders the isolated empty fixture with accessible tabs', async () => {
  get.mockResolvedValueOnce({ data: profile }).mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({ data: { items: [] } })
  renderPage()

  expect(await screen.findByText('North Star Repairs')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Services' })).toHaveAttribute('aria-selected', 'true')
  fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }))
  expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('No reviews yet')).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Reviews' }), { key: 'ArrowRight' })
  expect(screen.getByRole('tab', { name: 'Gallery' })).toHaveAttribute('aria-selected', 'true')
})

it('copies the current profile URL when native share is unavailable', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  get.mockResolvedValueOnce({ data: profile }).mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({ data: { items: [] } })
  renderPage()

  fireEvent.click(await screen.findByRole('button', { name: 'Share business profile' }))
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href))
  expect(screen.getByText('Link copied')).toBeInTheDocument()
})

it('offers a retry after an API error', async () => {
  get.mockRejectedValueOnce({ response: { data: { error: 'Profile unavailable' } } })
  renderPage()

  expect(await screen.findByRole('alert')).toHaveTextContent('Profile unavailable')
  get.mockResolvedValueOnce({ data: profile }).mockResolvedValueOnce({ data: { items: [] } }).mockResolvedValueOnce({ data: { items: [] } })
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('North Star Repairs')).toBeInTheDocument()
})
