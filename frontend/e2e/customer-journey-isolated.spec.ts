import { expect, test, type Page, type Route } from '@playwright/test'

const fixture = {
  customer: { id: 'fixture-customer', email: 'customer.fixture@example.invalid', displayName: 'Fixture Customer', role: 'customer' },
  orderId: 'fixture-order',
  contractVersionId: 'fixture-contract-version',
}

function order(status: 'matching' | 'contracted') {
  return {
    id: fixture.orderId, offerId: fixture.orderId, orderId: fixture.orderId, jobId: null,
    customerId: fixture.customer.id, serviceCatalogId: 'fixture-service', description: 'A detailed fixture request for the browser journey.',
    descriptionAiAssisted: false, scheduledAt: '2030-01-01T10:00:00.000Z', scheduleFlexibility: 'specific', address: '100 Fixture Street',
    locationLat: null, locationLng: null, entryPoint: 'wizard', urgency: 'standard', status, phase: status === 'matching' ? 'offer' : 'order',
    matchedPackageId: status === 'contracted' ? 'fixture-package' : null, matchedProviderId: status === 'contracted' ? 'fixture-provider' : null,
    matchedWorkspaceId: status === 'contracted' ? 'fixture-workspace' : null, assignedStaffId: null, assignedStaff: null,
    autoMatchExhausted: false, matchingExpiresAt: null, customerPicks: null, budget: null, budgetMin: null, budgetMax: null,
    cancelReason: null, cancelledAt: null, submittedAt: null, createdAt: '2026-11-25T00:00:00.000Z', updatedAt: '2026-11-25T00:00:00.000Z',
    schema: null, staleSnapshot: false, payment: null, customerReview: null, customerContract: null,
    matchedSummary: status === 'contracted' ? { provider: { id: 'fixture-provider', displayName: 'Fixture Provider' }, workspace: { id: 'fixture-workspace', name: 'Fixture Workspace' }, package: { id: 'fixture-package', name: 'Fixture Package', finalPrice: 4200, currency: 'CAD' } } : null,
  }
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

async function installFixture(page: Page) {
  let selected = false
  let approved = false
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname
    const method = route.request().method()
    if (method === 'POST' && path === '/api/auth/register') return json(route, { accessToken: 'fixture-token', user: fixture.customer })
    // AppShell refreshes the authenticated profile after registration. Keep the
    // fixture identity stable so owner-only provider selection is exercised.
    if (method === 'GET' && path === '/api/auth/me') return json(route, fixture.customer)
    if (method === 'GET' && path === '/api/social/posts/feed') return json(route, { data: [], nextPage: null })
    if (method === 'GET' && path === '/api/categories') return json(route, [])
    // CategoryStep renders briefly before a selected service advances the
    // wizard. Its contract is an array, not the generic `{ data: [] }` shape.
    if (method === 'GET' && path === '/api/categories/tree') return json(route, [])
    if (method === 'GET' && path === '/api/service-catalog/fixture-service') return json(route, { id: 'fixture-service', name: 'Fixture Service', price: 42 })
    if (method === 'GET' && path === '/api/service-catalog/fixture-service/schema') return json(route, { schema: { fields: [] } })
    if (method === 'POST' && path === '/api/orders/draft') return json(route, { id: 'fixture-draft' }, 201)
    if (method === 'POST' && path === '/api/orders/draft/fixture-draft/submit') return json(route, order('matching'))
    if (method === 'GET' && path === `/api/orders/${fixture.orderId}`) return json(route, order(selected ? 'contracted' : 'matching'))
    if (method === 'GET' && path === `/api/orders/${fixture.orderId}/candidates`) return json(route, { candidates: selected ? [] : [{ attemptId: 'fixture-attempt', providerName: 'Fixture Provider', workspaceName: 'Fixture Workspace', packageName: 'Fixture Package', packageFinalPrice: 42, packageCurrency: 'CAD' }] })
    if (method === 'POST' && path === `/api/orders/${fixture.orderId}/select-provider`) { selected = true; return json(route, {}) }
    if (method === 'GET' && path === `/api/orders/${fixture.orderId}/contracts`) return json(route, { contract: { id: 'fixture-contract', orderId: fixture.orderId, currentVersionId: fixture.contractVersionId, currentVersion: { id: fixture.contractVersionId, versionNumber: 1, status: approved ? 'approved' : 'sent', title: 'Fixture agreement', termsMarkdown: 'Fixture terms', policiesMarkdown: null, scopeSummary: 'Fixture scope', amount: 4200, currency: 'CAD', sentAt: null, reviewedAt: null, reviewNote: null, createdAt: '2026-11-25T00:00:00.000Z' } }, versions: [{ id: fixture.contractVersionId, versionNumber: 1, status: approved ? 'approved' : 'sent', title: 'Fixture agreement', termsMarkdown: 'Fixture terms', policiesMarkdown: null, scopeSummary: 'Fixture scope', amount: 4200, currency: 'CAD', sentAt: null, reviewedAt: null, reviewNote: null, createdAt: '2026-11-25T00:00:00.000Z' }], events: [] })
    if (method === 'POST' && path === `/api/orders/${fixture.orderId}/contracts/${fixture.contractVersionId}/approve`) { approved = true; return json(route, { version: { id: fixture.contractVersionId, status: 'approved' } }) }
    return json(route, { data: [] })
  })
}

test('customer completes the isolated fixture journey', async ({ page }, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await installFixture(page)
  await page.goto('/auth/register')
  await page.getByLabel('First name').fill('Fixture')
  await page.getByLabel('Last name').fill('Customer')
  await page.getByLabel('Email').fill(fixture.customer.email)
  await page.getByLabel('Password').fill('fixture-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/app\/home/)
  await expect(page.locator('body')).toBeVisible()

  await page.goto('/explore')
  await page.waitForTimeout(100)
  expect(pageErrors).toEqual([])
  await expect(page.getByText('Nearby')).toBeVisible()
  await page.goto('/order/new?serviceId=fixture-service')
  await expect(page.getByText('Service Details')).toBeVisible()
  expect(pageErrors).toEqual([])
  await page.getByLabel('Description *').fill('A detailed fixture request for the browser journey.')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Service Address *').fill('100 Fixture Street')
  await page.getByLabel('Preferred Date & Time *').fill('2030-01-01T10:00')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Submit Order' }).click()
  await expect(page).toHaveURL(new RegExp(`/app/orders/${fixture.orderId}`))
  await page.getByRole('button', { name: 'Select Provider' }).click()
  // The success status is intentionally transient: the refetched contracted
  // order replaces the matching-only offer card immediately.
  await expect(page.getByText('Fixture Provider')).toBeVisible()
  await expect(page.getByText('Contracted', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Contract' }).click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('Contract approved.')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath(`customer-journey-${testInfo.project.name}.png`), fullPage: true })
  expect(pageErrors).toEqual([])
})
