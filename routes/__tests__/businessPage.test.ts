import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import http from 'http';

// ── Mock prisma (inline factory — no top-level variables) ────────────────────

vi.mock('../../lib/db.js', () => ({
  default: {
    company: {
      findUnique: vi.fn(),
    },
    businessVerification: {
      findUnique: vi.fn(),
    },
    businessTrustScore: {
      findUnique: vi.fn(),
    },
    businessPortfolio: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    providerServicePackage: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    companyUser: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    orderReview: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    order: {
      count: vi.fn(),
    },
    packageStaffAssignment: {
      groupBy: vi.fn(),
    },
  },
}));

// ── Mock profileVisibility (inline factory) ──────────────────────────────────

vi.mock('../../lib/profileVisibility.js', () => ({
  hasContractedOrderWithWorkspace: vi.fn(),
  isAdminRole: vi.fn(),
  CONTACT_FIELDS: ['phone', 'address', 'website', 'socialLinks'],
}));

// ── Mock auth middleware ─────────────────────────────────────────────────────

vi.mock('../../lib/auth.middleware.js', () => ({
  authenticate: vi.fn((_req: any, _res: any, next: any) => next()),
  AuthRequest: {} as any,
}));

// ── Import modules after mocks ───────────────────────────────────────────────

import businessPageRouter from '../businessPage.js';
import prisma from '../../lib/db.js';
import { hasContractedOrderWithWorkspace, isAdminRole } from '../../lib/profileVisibility.js';

interface CreateAppOptions {
  user?: { userId: string; role: string } | null;
}

function createTestApp(opts: CreateAppOptions = {}) {
  const app = express();
  app.use(express.json());
  // Inject user if provided
  if (opts.user) {
    app.use((req: any, _res: any, next: any) => {
      req.user = opts.user;
      next();
    });
  }
  app.use('/api/business-page', businessPageRouter);
  return http.createServer(app);
}

// ── Helper for HTTP requests ─────────────────────────────────────────────────

function doRequest(
  method: 'GET' | 'PUT',
  server: http.Server,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const port = (server.address() as any)?.port ?? 0;
    const options = {
      hostname: 'localhost',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 500, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 500, body: {} });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ── Test Data ────────────────────────────────────────────────────────────────

const mockCompany = {
  id: 'company-1',
  name: 'Test Business',
  slug: 'test-business',
  slogan: 'We test things',
  about: 'A testing company',
  logoUrl: 'https://example.com/logo.png',
  coverImageUrl: 'https://example.com/cover.png',
  address: '123 Test St',
  phone: '+1-555-0100',
  website: 'https://testbusiness.com',
  type: 'company',
  kycStatus: 'approved',
  location: null,
  experienceDate: new Date('2020-01-01'),
  owner: { id: 'owner-1', displayName: 'Owner Name', avatarUrl: null },
  members: [],
};

const mockVerification = {
  workspaceId: 'company-1',
  licenseNumber: 'LIC-12345',
  licenseVerifiedAt: new Date(),
  hasLiabilityInsurance: true,
  insuranceVerifiedAt: new Date(),
};

const mockTrustScore = {
  workspaceId: 'company-1',
  avgRating: 4.5,
  totalScore: 92,
  kycVerified: true,
};

const mockPortfolio = {
  companyId: 'company-1',
  history: 'Our history',
  mission: 'Our mission',
  galleryUrls: ['https://example.com/g1.jpg'],
  businessHours: { monday: { open: '09:00', close: '17:00' } },
  tags: ['plumbing', 'repair'],
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/business-page/:companyId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (hasContractedOrderWithWorkspace as any).mockResolvedValue(false);
    (isAdminRole as any).mockReturnValue(false);
  });

  it('returns 404 when company not found', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(null);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Business not found');
    app.close();
  });

  it('returns full business profile on happy path', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(mockCompany);
    (prisma.businessVerification.findUnique as any).mockResolvedValue(mockVerification);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(mockTrustScore);
    (prisma.businessPortfolio.findUnique as any).mockResolvedValue(mockPortfolio);
    (prisma.providerServicePackage.count as any).mockResolvedValue(5);
    (prisma.companyUser.count as any).mockResolvedValue(3);
    (prisma.orderReview.count as any).mockResolvedValue(10);
    (prisma.order.count as any).mockResolvedValue(25);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(200);
    expect(res.body.company.id).toBe('company-1');
    expect(res.body.company.name).toBe('Test Business');

    // Trust data
    expect(res.body.trust.licenseNumber).toBe('LIC-12345');
    expect(res.body.trust.licenseVerified).toBe(true);
    expect(res.body.trust.hasLiabilityInsurance).toBe(true);
    expect(res.body.trust.insuranceVerified).toBe(true);
    expect(res.body.trust.avgRating).toBe(4.5);
    expect(res.body.trust.totalScore).toBe(92);
    expect(res.body.trust.kycVerified).toBe(true);

    // Portfolio data
    expect(res.body.portfolio.history).toBe('Our history');
    expect(res.body.portfolio.mission).toBe('Our mission');
    expect(res.body.portfolio.galleryUrls).toHaveLength(1);
    expect(res.body.portfolio.tags).toContain('plumbing');

    // Stats
    expect(res.body.stats.totalServices).toBe(5);
    expect(res.body.stats.totalStaff).toBe(3);
    expect(res.body.stats.totalReviews).toBe(10);
    expect(res.body.stats.totalOrders).toBe(25);
    app.close();
  });

  it('masks contact fields when unauthenticated', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(mockCompany);
    (prisma.businessVerification.findUnique as any).mockResolvedValue(mockVerification);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(mockTrustScore);
    (prisma.businessPortfolio.findUnique as any).mockResolvedValue(mockPortfolio);
    (prisma.providerServicePackage.count as any).mockResolvedValue(0);
    (prisma.companyUser.count as any).mockResolvedValue(0);
    (prisma.orderReview.count as any).mockResolvedValue(0);
    (prisma.order.count as any).mockResolvedValue(0);
    (hasContractedOrderWithWorkspace as any).mockResolvedValue(false);
    const app = createTestApp(); // no user injected
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(200);
    expect(res.body.company.phone).toBeNull();
    expect(res.body.company.address).toBeNull();
    expect(res.body.company.website).toBeNull();
    expect(res.body.company.contactHidden).toBe(true);
    app.close();
  });

  it('reveals contact fields when user has a contracted order', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(mockCompany);
    (prisma.businessVerification.findUnique as any).mockResolvedValue(mockVerification);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(mockTrustScore);
    (prisma.businessPortfolio.findUnique as any).mockResolvedValue(mockPortfolio);
    (prisma.providerServicePackage.count as any).mockResolvedValue(0);
    (prisma.companyUser.count as any).mockResolvedValue(0);
    (prisma.orderReview.count as any).mockResolvedValue(0);
    (prisma.order.count as any).mockResolvedValue(0);
    (hasContractedOrderWithWorkspace as any).mockResolvedValue(true);
    (isAdminRole as any).mockReturnValue(false);
    const app = createTestApp({ user: { userId: 'cust-1', role: 'customer' } });
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(200);
    expect(res.body.company.phone).toBe('+1-555-0100');
    expect(res.body.company.address).toBe('123 Test St');
    expect(res.body.company.website).toBe('https://testbusiness.com');
    expect(res.body.company.contactHidden).toBeUndefined();
    app.close();
  });

  it('reveals all fields for admin users regardless of contract', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(mockCompany);
    (prisma.businessVerification.findUnique as any).mockResolvedValue(mockVerification);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(mockTrustScore);
    (prisma.businessPortfolio.findUnique as any).mockResolvedValue(mockPortfolio);
    (prisma.providerServicePackage.count as any).mockResolvedValue(0);
    (prisma.companyUser.count as any).mockResolvedValue(0);
    (prisma.orderReview.count as any).mockResolvedValue(0);
    (prisma.order.count as any).mockResolvedValue(0);
    (isAdminRole as any).mockReturnValue(true);
    (hasContractedOrderWithWorkspace as any).mockResolvedValue(false);
    const app = createTestApp({ user: { userId: 'admin-1', role: 'platform_admin' } });
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(200);
    expect(res.body.company.phone).toBe('+1-555-0100');
    expect(res.body.company.address).toBe('123 Test St');
    expect(res.body.company.website).toBe('https://testbusiness.com');
    expect(res.body.company.contactHidden).toBeUndefined();
    app.close();
  });

  it('returns zero stats when no data exists', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(mockCompany);
    (prisma.businessVerification.findUnique as any).mockResolvedValue(null);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(null);
    (prisma.businessPortfolio.findUnique as any).mockResolvedValue(null);
    (prisma.providerServicePackage.count as any).mockResolvedValue(0);
    (prisma.companyUser.count as any).mockResolvedValue(0);
    (prisma.orderReview.count as any).mockResolvedValue(0);
    (prisma.order.count as any).mockResolvedValue(0);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1');

    expect(res.status).toBe(200);
    expect(res.body.trust.licenseNumber).toBeNull();
    expect(res.body.trust.licenseVerified).toBe(false);
    expect(res.body.trust.hasLiabilityInsurance).toBe(false);
    expect(res.body.trust.insuranceVerified).toBe(false);
    expect(res.body.trust.avgRating).toBe(0);
    expect(res.body.trust.totalScore).toBe(0);
    expect(res.body.trust.kycVerified).toBe(false);
    expect(res.body.portfolio.history).toBeNull();
    expect(res.body.portfolio.mission).toBeNull();
    expect(res.body.portfolio.galleryUrls).toEqual([]);
    expect(res.body.stats.totalServices).toBe(0);
    expect(res.body.stats.totalStaff).toBe(0);
    expect(res.body.stats.totalReviews).toBe(0);
    expect(res.body.stats.totalOrders).toBe(0);
    app.close();
  });
});

describe('GET /api/business-page/:companyId/trust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when company not found', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(null);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/trust');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Business not found');
    app.close();
  });

  it('returns trust layer data', async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: 'company-1',
      experienceDate: new Date('2020-01-01'),
    });
    (prisma.businessVerification.findUnique as any).mockResolvedValue(mockVerification);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(mockTrustScore);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/trust');

    expect(res.status).toBe(200);
    expect(res.body.licenseNumber).toBe('LIC-12345');
    expect(res.body.licenseVerified).toBe(true);
    expect(res.body.hasLiabilityInsurance).toBe(true);
    expect(res.body.insuranceVerified).toBe(true);
    expect(res.body.avgRating).toBe(4.5);
    expect(res.body.totalScore).toBe(92);
    expect(res.body.kycVerified).toBe(true);
    app.close();
  });

  it('returns null for missing trust data', async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: 'company-1',
      experienceDate: null,
    });
    (prisma.businessVerification.findUnique as any).mockResolvedValue(null);
    (prisma.businessTrustScore.findUnique as any).mockResolvedValue(null);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/trust');

    expect(res.status).toBe(200);
    expect(res.body.licenseNumber).toBeNull();
    expect(res.body.licenseVerified).toBe(false);
    expect(res.body.experienceYears).toBeNull();
    expect(res.body.avgRating).toBe(0);
    app.close();
  });
});

describe('GET /api/business-page/:companyId/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns services with staff assignments', async () => {
    const mockPackages = [
      {
        id: 'pkg-1',
        name: 'Basic Service',
        description: 'A basic service',
        finalPrice: 5000,
        currency: 'CAD',
        durationMinutes: 60,
        breakTimeMinutes: 10,
        bookingMode: 'appointment',
        photoRequired: true,
        sortOrder: 1,
        staffAssignments: [
          {
            isPrimary: true,
            staff: {
              id: 'staff-1',
              displayName: 'Jane Staff',
              firstName: 'Jane',
              lastName: 'Staff',
              avatarUrl: null,
            },
          },
        ],
        bom: [],
      },
    ];

    (prisma.providerServicePackage.findMany as any).mockResolvedValue(mockPackages);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/services');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Basic Service');
    expect(res.body.items[0].price).toBe(5000);
    expect(res.body.items[0].bookingMode).toBe('appointment');
    expect(res.body.items[0].photoRequired).toBe(true);
    expect(res.body.items[0].assignedStaff).toHaveLength(1);
    expect(res.body.items[0].assignedStaff[0].displayName).toBe('Jane Staff');
    expect(res.body.items[0].assignedStaff[0].isPrimary).toBe(true);
    app.close();
  });

  it('returns empty items when no services', async () => {
    (prisma.providerServicePackage.findMany as any).mockResolvedValue([]);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/services');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    app.close();
  });
});

describe('GET /api/business-page/:companyId/staff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns staff directory with assignment counts', async () => {
    const mockMembers = [
      {
        companyId: 'company-1',
        role: 'staff',
        user: {
          id: 'staff-1',
          displayName: 'Jane Staff',
          firstName: 'Jane',
          lastName: 'Staff',
          avatarUrl: null,
          bio: 'Experienced plumber',
          role: 'staff',
        },
      },
    ];

    (prisma.companyUser.findMany as any).mockResolvedValue(mockMembers);
    (prisma.packageStaffAssignment.groupBy as any).mockResolvedValue([
      { staffId: 'staff-1', _count: 3 },
    ]);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/staff');

    expect(res.status).toBe(200);
    expect(res.body.staff).toHaveLength(1);
    expect(res.body.staff[0].displayName).toBe('Jane Staff');
    expect(res.body.staff[0].bio).toBe('Experienced plumber');
    expect(res.body.staff[0].assignedServiceCount).toBe(3);
    app.close();
  });

  it('returns empty staff list when no members', async () => {
    (prisma.companyUser.findMany as any).mockResolvedValue([]);
    (prisma.packageStaffAssignment.groupBy as any).mockResolvedValue([]);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/staff');

    expect(res.status).toBe(200);
    expect(res.body.staff).toEqual([]);
    app.close();
  });
});

describe('GET /api/business-page/:companyId/reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns reviews with customer info', async () => {
    const mockReviews = [
      {
        id: 'review-1',
        rating: 5,
        reviewText: 'Great service!',
        createdAt: new Date('2025-01-15'),
        customer: {
          id: 'cust-1',
          displayName: 'John Customer',
          firstName: 'John',
          lastName: 'Customer',
          avatarUrl: null,
        },
        order: {
          id: 'order-1',
          description: 'Fix sink',
          matchedPackage: { name: 'Plumbing Repair' },
        },
      },
    ];

    (prisma.orderReview.findMany as any).mockResolvedValue(mockReviews);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/reviews');

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].rating).toBe(5);
    expect(res.body.items[0].reviewText).toBe('Great service!');
    expect(res.body.items[0].customer.displayName).toBe('John Customer');
    expect(res.body.items[0].serviceName).toBe('Plumbing Repair');
    app.close();
  });

  it('returns empty items when no reviews', async () => {
    (prisma.orderReview.findMany as any).mockResolvedValue([]);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('GET', app, '/api/business-page/company-1/reviews');

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    app.close();
  });
});

describe('PUT /api/business-page/:companyId/portfolio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when company not found', async () => {
    (prisma.company.findUnique as any).mockResolvedValue(null);
    const app = createTestApp();
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('PUT', app, '/api/business-page/company-1/portfolio', { history: 'New history' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Business not found');
    app.close();
  });

  it('returns 403 when user is not owner', async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: 'company-1',
      ownerId: 'owner-99',
    });
    const app = createTestApp({ user: { userId: 'other-user', role: 'customer' } });
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('PUT', app, '/api/business-page/company-1/portfolio', { history: 'New history' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    app.close();
  });

  it('upserts portfolio when user is owner', async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: 'company-1',
      ownerId: 'owner-1',
    });

    const updatedPortfolio = {
      companyId: 'company-1',
      history: 'New history',
      mission: 'New mission',
      galleryUrls: [],
      businessHours: null,
      tags: [],
    };
    (prisma.businessPortfolio.upsert as any).mockResolvedValue(updatedPortfolio);
    const app = createTestApp({ user: { userId: 'owner-1', role: 'provider' } });
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('PUT', app, '/api/business-page/company-1/portfolio', {
      history: 'New history',
      mission: 'New mission',
    });

    expect(res.status).toBe(200);
    expect(prisma.businessPortfolio.upsert).toHaveBeenCalled();
    app.close();
  });

  it('allows admin to upsert portfolio', async () => {
    (prisma.company.findUnique as any).mockResolvedValue({
      id: 'company-1',
      ownerId: 'owner-99',
    });

    const updatedPortfolio = {
      companyId: 'company-1',
      history: 'Admin update',
      mission: null,
      galleryUrls: [],
      businessHours: null,
      tags: [],
    };
    (prisma.businessPortfolio.upsert as any).mockResolvedValue(updatedPortfolio);
    const app = createTestApp({ user: { userId: 'admin-1', role: 'platform_admin' } });
    await new Promise<void>((resolve) => app.listen(0, () => resolve()));

    const res = await doRequest('PUT', app, '/api/business-page/company-1/portfolio', {
      history: 'Admin update',
    });

    expect(res.status).toBe(200);
    expect(prisma.businessPortfolio.upsert).toHaveBeenCalled();
    app.close();
  });
});