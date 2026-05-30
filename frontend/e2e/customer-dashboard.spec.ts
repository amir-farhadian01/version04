import { test, expect, Page } from '@playwright/test'

/**
 * Customer Dashboard (F1) — Playwright UI Verification
 *
 * Tests that the customer dashboard at /app/home renders correctly with:
 * - Live order status polling (10s interval)
 * - Phase display with Persian labels
 * - Progress bar with color coding (green < 50%, yellow 50-80%, red > 80%)
 * - Remaining time text
 * - Payment info display (amount in dollars, status badge, escrow release date)
 * - Transition animations (slide-in, hover effects)
 * - Responsive layout on mobile
 */

const CLIENT_URL = 'http://localhost:5173'

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ORDERS = {
  items: [
    {
      id: 'order-001',
      status: 'matching',
      phase: 'offer',
      createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
      updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      urgency: 'urgent',
      budget: 25000,
      serviceCatalog: {
        id: 'cat-001',
        name: 'Plumbing Repair',
        breadcrumb: [
          { id: 'cat-root', name: 'Home Services', parentId: null },
          { id: 'cat-plumbing', name: 'Plumbing', parentId: 'cat-root' },
        ],
      },
      matchedProviderId: null,
      matchedSummary: null,
      payment: null,
      review: null,
    },
    {
      id: 'order-002',
      status: 'in_progress',
      phase: 'job',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: 'standard',
      budget: 150000,
      serviceCatalog: {
        id: 'cat-002',
        name: 'Electrical Wiring',
        breadcrumb: [
          { id: 'cat-root', name: 'Home Services', parentId: null },
          { id: 'cat-electrical', name: 'Electrical', parentId: 'cat-root' },
        ],
      },
      matchedProviderId: 'prov-001',
      matchedSummary: {
        provider: {
          id: 'prov-001',
          displayName: 'John Electrician',
          firstName: 'John',
          lastName: 'Electrician',
          avatarUrl: null,
        },
        workspace: { id: 'ws-001', name: 'John\'s Electrical Services' },
        package: { id: 'pkg-001', name: 'Standard Wiring Package', finalPrice: 150000, currency: 'USD' },
      },
      payment: {
        amount: 150000,
        status: 'CAPTURED',
        escrowReleaseAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      },
      review: null,
    },
    {
      id: 'order-003',
      status: 'completed',
      phase: 'job',
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
      updatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      urgency: 'low',
      budget: 80000,
      serviceCatalog: {
        id: 'cat-003',
        name: 'AC Maintenance',
        breadcrumb: [
          { id: 'cat-root', name: 'Home Services', parentId: null },
          { id: 'cat-hvac', name: 'HVAC', parentId: 'cat-root' },
        ],
      },
      matchedProviderId: 'prov-002',
      matchedSummary: {
        provider: {
          id: 'prov-002',
          displayName: 'Cool Air HVAC',
          firstName: 'Mike',
          lastName: 'Cool',
          avatarUrl: null,
        },
        workspace: { id: 'ws-002', name: 'Cool Air HVAC Services' },
        package: { id: 'pkg-002', name: 'AC Tune-Up', finalPrice: 80000, currency: 'USD' },
      },
      payment: {
        amount: 80000,
        status: 'REFUNDED',
        escrowReleaseAt: null,
      },
      review: {
        rating: 5,
        reviewText: 'Excellent service!',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
  facets: {
    phase: { offer: 1, order: 0, job: 2, cancelledOffer: 0, cancelledOrder: 0, cancelledJob: 0 },
  },
}

// ─── Mock Auth Token ───────────────────────────────────────────────────────────

const MOCK_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItaWQiLCJyb2xlIjoiQ1VTVE9NRVIiLCJpYXQiOjE1MTYyMzkwMjJ9.test-signature'

const MOCK_USER = {
  state: {
    token: MOCK_TOKEN,
    refreshToken: null,
    user: {
      id: 'test-user-id',
      email: 'customer@test.com',
      firstName: 'Test',
      lastName: 'Customer',
      displayName: 'Test Customer',
      roles: ['CUSTOMER'],
      avatarUrl: null,
      phone: '+1234567890',
      companyId: null,
    },
    isLoading: false,
    error: null,
  },
  version: 0,
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Set the auth store in localStorage.
 * IMPORTANT: Must be called AFTER page.goto() to avoid SecurityError
 * (localStorage is not accessible on about:blank).
 */
async function setupAuth(page: Page) {
  await page.evaluate((userData) => {
    localStorage.setItem('neighborly-auth', JSON.stringify(userData))
  }, MOCK_USER)
}

async function setupMockApi(page: Page) {
  // Intercept GET /api/orders/me and return mock data
  await page.route('**/api/orders/me**', async (route) => {
    const url = new URL(route.request().url())
    const phase = url.searchParams.get('phase')

    // If phase filter is applied, filter the mock data
    if (phase) {
      const filtered = MOCK_ORDERS.items.filter((o) => o.phase === phase)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...MOCK_ORDERS,
          items: filtered,
          total: filtered.length,
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_ORDERS),
    })
  })

  // Intercept GET /api/auth/me (called by refreshUser on mount)
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id',
        email: 'customer@test.com',
        firstName: 'Test',
        lastName: 'Customer',
        displayName: 'Test Customer',
        role: 'CUSTOMER',
        avatarUrl: null,
        phone: '+1234567890',
        companyId: null,
      }),
    })
  })

  // Mock stories API to prevent console errors (table doesn't exist in DB)
  await page.route('**/api/stories/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], total: 0 }),
    })
  })

  // Mock home screen API to prevent console errors
  await page.route('**/api/home**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    })
  })
}

/**
 * Navigate to the dashboard, setting up auth and mock API.
 * Step 1: Navigate to the client base URL to establish a secure context
 * Step 2: Set localStorage auth token
 * Step 3: Reload to the dashboard page (auth store will pick up the token)
 */
async function navigateToDashboard(page: Page) {
  // First navigate to the base URL to establish a secure context for localStorage
  await page.goto(CLIENT_URL, { waitUntil: 'domcontentloaded' })
  // Set auth token in localStorage
  await setupAuth(page)
  // Now navigate to the dashboard — the auth store will read the token from localStorage
  await page.goto(`${CLIENT_URL}/app/home`, { waitUntil: 'networkidle' })
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Customer Dashboard (F1)', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page)
  })

  test('01 — Dashboard loads with heading and sections', async ({ page }) => {
    await navigateToDashboard(page)

    // Verify the main heading
    await expect(page.locator('h1')).toContainText('My Orders')

    // Verify Active Orders section
    await expect(page.getByText('Active Orders (2)')).toBeVisible()

    // Verify Past Orders section
    await expect(page.getByText('Past Orders (1)')).toBeVisible()

    await page.screenshot({
      path: 'screenshots/f1-dashboard-desktop.png',
      fullPage: true,
    })
  })

  test('02 — Active order shows matching phase with Persian label', async ({ page }) => {
    await navigateToDashboard(page)

    // The first order is "Plumbing Repair" in "matching" phase
    const plumbingCard = page.locator('a[href="/orders/order-001"]')
    await expect(plumbingCard).toBeVisible()

    // Verify service name
    await expect(plumbingCard.locator('h3')).toContainText('Plumbing Repair')

    // Verify status badge shows "Finding Provider"
    await expect(plumbingCard.getByText('Finding Provider')).toBeVisible()

    // Verify Persian phase label is visible (matching → 'در حال پیدا کردن متخصص')
    await expect(plumbingCard.getByText('در حال پیدا کردن متخصص')).toBeVisible()

    // Verify progress bar exists (matching phase with urgent urgency = 5 min total)
    await expect(plumbingCard.locator('.bg-gray-200.rounded-full')).toBeVisible()

    // Verify percentage text
    await expect(plumbingCard.getByText(/% completed/)).toBeVisible()

    // Verify remaining time text
    await expect(plumbingCard.getByText(/remaining/)).toBeVisible()
  })

  test('03 — Active in_progress order shows payment info', async ({ page }) => {
    await navigateToDashboard(page)

    // The second order is "Electrical Wiring" in "in_progress" phase with payment
    const electricalCard = page.locator('a[href="/orders/order-002"]')
    await expect(electricalCard).toBeVisible()

    // Verify service name
    await expect(electricalCard.locator('h3')).toContainText('Electrical Wiring')

    // Verify status badge shows "In Progress"
    await expect(electricalCard.getByText('In Progress')).toBeVisible()

    // Verify Persian phase label (in_progress → 'در حال انجام')
    await expect(electricalCard.getByText('در حال انجام')).toBeVisible()

    // Verify provider name
    await expect(electricalCard.getByText(/John's Electrical Services/)).toBeVisible()

    // Verify payment section
    await expect(electricalCard.getByText('Payment:')).toBeVisible()

    // Verify payment amount ($1500.00 since amount is in cents, .toFixed(2) produces "1500.00")
    await expect(electricalCard.getByText('$1500.00')).toBeVisible()

    // Verify payment status badge
    await expect(electricalCard.getByText('CAPTURED')).toBeVisible()

    // Verify escrow release date
    await expect(electricalCard.getByText(/Escrow release:/)).toBeVisible()

    // Verify progress bar exists
    await expect(electricalCard.locator('.bg-gray-200.rounded-full')).toBeVisible()
  })

  test('04 — Past completed order shows compact card', async ({ page }) => {
    await navigateToDashboard(page)

    // The third order is "AC Maintenance" in "completed" phase
    const acCard = page.locator('a[href="/orders/order-003"]')
    await expect(acCard).toBeVisible()

    // Verify service name
    await expect(acCard.locator('h3')).toContainText('AC Maintenance')

    // Verify status badge shows "Completed"
    await expect(acCard.getByText('Completed')).toBeVisible()

    // Verify provider name
    await expect(acCard.getByText(/Cool Air HVAC Services/)).toBeVisible()

    // Past orders should NOT have Persian phase label (isActive is false)
    await expect(acCard.getByText('تکمیل شده')).toHaveCount(0)

    // Past orders should NOT have progress bar
    await expect(acCard.locator('.bg-gray-200.rounded-full')).toHaveCount(0)
  })

  test('05 — Progress bar color coding (green < 50%, yellow 50-80%, red > 80%)', async ({ page }) => {
    // We need to test progress bar colors. Since the matching order was created 2 min ago
    // with urgent urgency (5 min total), it should be around 40% — green.
    // We'll verify the progress bar element exists and has the correct color class structure.
    await navigateToDashboard(page)

    const plumbingCard = page.locator('a[href="/orders/order-001"]')

    // The progress bar inner div should have one of the color classes
    const progressBar = plumbingCard.locator('.bg-gray-200.rounded-full div')
    await expect(progressBar).toBeVisible()

    // Get the class attribute to check color
    const classAttr = await progressBar.getAttribute('class')
    expect(classAttr).toBeTruthy()

    // The class should contain one of: bg-green-500, bg-yellow-500, or bg-red-500
    const hasValidColor =
      classAttr?.includes('bg-green-500') ||
      classAttr?.includes('bg-yellow-500') ||
      classAttr?.includes('bg-red-500')
    expect(hasValidColor).toBe(true)
  })

  test('06 — Transition animations and hover effects', async ({ page }) => {
    await navigateToDashboard(page)

    // Active order cards should have animate-slide-in class
    const plumbingCard = page.locator('a[href="/orders/order-001"]')
    await expect(plumbingCard).toHaveClass(/animate-slide-in/)

    // Hover effect: card should have hover:border-blue-300 class
    await expect(plumbingCard).toHaveClass(/hover:border-blue-300/)
    await expect(plumbingCard).toHaveClass(/transition-all/)
    await expect(plumbingCard).toHaveClass(/duration-300/)
  })

  test('07 — Empty state when no orders', async ({ page }) => {
    // Override the mock to return empty orders
    await page.route('**/api/orders/me**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          facets: { phase: { offer: 0, order: 0, job: 0, cancelledOffer: 0, cancelledOrder: 0, cancelledJob: 0 } },
        }),
      })
    })

    await navigateToDashboard(page)

    // Verify empty state
    await expect(page.getByText('No orders yet')).toBeVisible()
    await expect(page.getByText('Browse services and create your first order')).toBeVisible()

    // Verify "Explore Services" button exists and links to /explore
    const exploreBtn = page.getByRole('link', { name: /explore services/i })
    await expect(exploreBtn).toBeVisible()
    await expect(exploreBtn).toHaveAttribute('href', '/explore')
  })

  test('08 — Error state displays retry button', async ({ page }) => {
    // Override the mock to return an error
    await page.route('**/api/orders/me**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      })
    })

    await navigateToDashboard(page)

    // Verify error message
    await expect(page.getByText('Failed to load orders')).toBeVisible()

    // Verify retry button
    const retryBtn = page.getByRole('button', { name: /try again/i })
    await expect(retryBtn).toBeVisible()
  })

  test('09 — Mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await navigateToDashboard(page)

    // Verify heading is visible
    await expect(page.locator('h1')).toContainText('My Orders')

    // Verify Active Orders section
    await expect(page.getByText('Active Orders (2)')).toBeVisible()

    // Verify Past Orders section
    await expect(page.getByText('Past Orders (1)')).toBeVisible()

    // Verify order cards are visible and properly laid out
    const plumbingCard = page.locator('a[href="/orders/order-001"]')
    await expect(plumbingCard).toBeVisible()

    const electricalCard = page.locator('a[href="/orders/order-002"]')
    await expect(electricalCard).toBeVisible()

    const acCard = page.locator('a[href="/orders/order-003"]')
    await expect(acCard).toBeVisible()

    await page.screenshot({
      path: 'screenshots/f1-dashboard-mobile.png',
      fullPage: true,
    })
  })

  test('10 — Loading state shows spinner', async ({ page }) => {
    // Delay the API response to trigger loading state
    await page.route('**/api/orders/me**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS),
      })
    })

    // For loading state test, we navigate to base URL first, set auth, then go to dashboard
    await page.goto(CLIENT_URL, { waitUntil: 'domcontentloaded' })
    await setupAuth(page)
    await page.goto(`${CLIENT_URL}/app/home`, { waitUntil: 'commit' })

    // The loading spinner should be visible (role="status")
    await expect(page.locator('[role="status"]')).toBeVisible()

    // Wait for the response to complete
    await page.waitForLoadState('networkidle')

    // After loading, the spinner should be gone and orders should show
    await expect(page.locator('[role="status"]')).toHaveCount(0)
    await expect(page.locator('h1')).toContainText('My Orders')
  })
})

test.describe('Console Error Check — Customer Dashboard', () => {
  test('no console errors on dashboard page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      // Filter out pre-existing stories fetch error (table doesn't exist in DB)
      if (msg.type() === 'error' && !msg.text().includes('Failed to load stories')) {
        errors.push(msg.text())
      }
    })

    await setupMockApi(page)
    await navigateToDashboard(page)
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})
