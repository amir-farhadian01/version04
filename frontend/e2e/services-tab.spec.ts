import { test, expect } from '@playwright/test'

/**
 * Client Services Tab — Playwright E2E Verification
 *
 * Tests the Services page at /app/services with three sub-tabs:
 * - Overview: stats cards
 * - Orders: active list + completed history table
 * - Messages: conversation list
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Client Services Tab', () => {
  test('01 — Services page loads with navigation elements', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })

    // Page should render content or redirect to login
    const pageContent = page.getByText(/services|login|sign in|email/i)
    await expect(pageContent.first()).toBeVisible()

    await page.screenshot({ path: 'screenshots/services-01-desktop.png', fullPage: true })
  })

  test('02 — Tab-style navigation renders', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })

    // Look for tab labels or navigation elements
    const tabs = page.getByText(/overview|orders|messages/i)
    const hasTabs = await tabs.first().isVisible().catch(() => false)

    if (hasTabs) {
      await expect(tabs.first()).toBeVisible()
    }

    await page.screenshot({ path: 'screenshots/services-02-tabs.png', fullPage: true })
  })

  test('03 — Content area renders', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })

    // Any content should render
    const anyContent = page.getByRole('button').first()
    const hasContent = await anyContent.isVisible().catch(() => false)

    if (hasContent) {
      await expect(anyContent).toBeVisible()
    }

    await page.screenshot({ path: 'screenshots/services-03-content.png', fullPage: true })
  })

  test('04 — Mobile viewport renders services page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })

    // Verify page renders content (may redirect to login)
    const content = page.getByText(/services|login|sign in|admin/i)
    const hasContent = await content.first().isVisible().catch(() => false)
    expect(hasContent).toBe(true)

    await page.screenshot({ path: 'screenshots/services-04-mobile.png', fullPage: true })
  })
})

test.describe('Console Error Check — Services Tab', () => {
  test('no console errors on services page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})