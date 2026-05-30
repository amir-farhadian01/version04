import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// ── Mock API (inline factory — no top-level variables) ───────────────────────

vi.mock('../../../lib/api', () => ({
  default: { get: vi.fn() },
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import api from '../../../lib/api';
import BusinessPage from '../BusinessPage';

function renderPage(companyId = 'company-1') {
  return render(
    <MemoryRouter initialEntries={[`/biz/${companyId}`]}>
      <Routes>
        <Route path="/biz/:id" element={<BusinessPage />} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Mock data ────────────────────────────────────────────────────────────────

const mockBusinessData = {
  company: {
    id: 'company-1',
    name: 'Test Business',
    slug: 'test-business',
    slogan: 'We test things',
    about: 'A testing company',
    logoUrl: null,
    coverImageUrl: null,
    address: '123 Test St',
    phone: '+1-555-0100',
    website: 'https://testbusiness.com',
    type: 'company',
    kycStatus: 'approved',
    location: null,
    contactHidden: false,
  },
  trust: {
    licenseNumber: 'LIC-12345',
    licenseVerified: true,
    hasLiabilityInsurance: true,
    insuranceVerified: true,
    experienceYears: 5,
    avgRating: 4.5,
    totalScore: 92,
    kycVerified: true,
  },
  portfolio: {
    history: 'Our company history',
    mission: 'Our mission statement',
    galleryUrls: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
    businessHours: { monday: { open: '09:00', close: '17:00' } },
    tags: ['plumbing', 'repair'],
  },
  stats: {
    totalServices: 5,
    totalStaff: 3,
    totalReviews: 10,
    totalOrders: 25,
  },
};

const mockPackages = {
  items: [
    {
      id: 'pkg-1',
      name: 'Basic Service',
      description: 'A basic plumbing service',
      price: 5000,
      currency: 'CAD',
      durationMinutes: 60,
      breakTimeMinutes: 10,
      bookingMode: 'appointment',
      photoRequired: true,
      assignedStaff: [
        {
          id: 'staff-1',
          displayName: 'Jane Staff',
          firstName: 'Jane',
          lastName: 'Staff',
          avatarUrl: null,
          isPrimary: true,
        },
      ],
    },
  ],
};

const mockReviews = {
  items: [
    {
      id: 'review-1',
      rating: 5,
      reviewText: 'Great service!',
      createdAt: '2025-01-15T00:00:00.000Z',
      customer: {
        id: 'cust-1',
        displayName: 'John Customer',
        firstName: 'John',
        lastName: 'Customer',
        avatarUrl: null,
      },
      serviceName: 'Plumbing Repair',
    },
  ],
};

// ── Helper to setup mock API with sequential responses ───────────────────────

function setupMockApi(responses: Array<{ data?: any; error?: any }>) {
  const mock = vi.fn();
  for (const r of responses) {
    if (r.error) {
      mock.mockRejectedValueOnce(r.error);
    } else {
      mock.mockResolvedValueOnce({ data: r.data });
    }
  }
  (api.get as any) = mock;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BusinessPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders loading state initially', () => {
    // Never-resolving promise to keep component in loading state
    (api.get as any) = vi.fn().mockImplementation(() => new Promise(() => {}));

    renderPage();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders error state on API failure', async () => {
    setupMockApi([
      { error: { response: { data: { error: 'Failed to load' } } } },
      { error: { response: { data: { error: 'Failed to load' } } } },
      { error: { response: { data: { error: 'Failed to load' } } } },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });
  });

  it('renders default error message when API fails with no error text', async () => {
    setupMockApi([
      { error: { response: { data: {} } } },
      { error: { response: { data: {} } } },
      { error: { response: { data: {} } } },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load business profile')).toBeInTheDocument();
    });
  });

  it('renders full business profile with trust badges', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: mockPackages },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    // Business header
    expect(screen.getByText('Business Profile')).toBeInTheDocument();

    // Trust badges
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText(/Insured/)).toBeInTheDocument();
    expect(screen.getByText(/Lic:/)).toBeInTheDocument();
    expect(screen.getByText(/Score:\s*92/)).toBeInTheDocument();

    // Stats
    expect(screen.getByText('⭐ 4.5 (10 reviews)')).toBeInTheDocument();
    expect(screen.getByText('🏆 5 yrs active')).toBeInTheDocument();

    // Tabs
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Gallery')).toBeInTheDocument();
  });

  it('displays service catalog with staff info', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: mockPackages },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    // Services tab is active by default (index 0)
    expect(screen.getByText('Basic Service')).toBeInTheDocument();
    expect(screen.getByText('A basic plumbing service')).toBeInTheDocument();
    expect(screen.getByText('$5000.00')).toBeInTheDocument();
    expect(screen.getByText('⏱ 60 min')).toBeInTheDocument();

    // Staff info (first name displayed for staff without avatar)
    expect(screen.getByText('Jane')).toBeInTheDocument();

    // Photo required badge
    expect(screen.getByText('Photo Required')).toBeInTheDocument();

    // Book Now button
    expect(screen.getByText('Book Now')).toBeInTheDocument();
  });

  it('shows empty state for no services', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: { items: [] } },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    expect(screen.getByText('No services available yet')).toBeInTheDocument();
  });

  it('switches to About tab and shows portfolio info', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: mockPackages },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    // Click About tab
    fireEvent.click(screen.getByText('About'));

    // Portfolio info
    expect(screen.getByText('Our Story')).toBeInTheDocument();
    expect(screen.getByText('Our company history')).toBeInTheDocument();
    expect(screen.getByText('Mission')).toBeInTheDocument();
    expect(screen.getByText('Our mission statement')).toBeInTheDocument();
    // company.about under "About" section
    expect(screen.getByText('A testing company')).toBeInTheDocument();

    // Tags
    expect(screen.getByText('plumbing')).toBeInTheDocument();
    expect(screen.getByText('repair')).toBeInTheDocument();
  });

  it('shows empty state for no about info', async () => {
    const emptyBusinessData = {
      ...mockBusinessData,
      portfolio: { ...mockBusinessData.portfolio, history: null, mission: null, tags: [] },
      company: { ...mockBusinessData.company, about: null },
    };

    setupMockApi([
      { data: emptyBusinessData },
      { data: { items: [] } },
      { data: { items: [] } },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('About'));

    expect(screen.getByText('No information available')).toBeInTheDocument();
  });

  it('switches to Reviews tab and shows reviews', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: mockPackages },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    // Click Reviews tab
    fireEvent.click(screen.getByText('Reviews'));

    // Review content
    expect(screen.getByText('Great service!')).toBeInTheDocument();
    expect(screen.getByText('John Customer')).toBeInTheDocument();
    expect(screen.getByText('Plumbing Repair')).toBeInTheDocument();

    // Stars — they are inline with date, so check for the star pattern
    expect(screen.getByText(/★{5}/)).toBeInTheDocument();
  });

  it('shows empty state for no reviews', async () => {
    setupMockApi([
      { data: mockBusinessData },
      { data: mockPackages },
      { data: { items: [] } },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Reviews'));

    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
  });

  it('shows empty state for no gallery', async () => {
    const emptyPortfolio = {
      ...mockBusinessData,
      portfolio: { ...mockBusinessData.portfolio, galleryUrls: [] },
    };

    setupMockApi([
      { data: emptyPortfolio },
      { data: mockPackages },
      { data: mockReviews },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Business')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Gallery'));

    expect(screen.getByText('No gallery images yet')).toBeInTheDocument();
  });
});