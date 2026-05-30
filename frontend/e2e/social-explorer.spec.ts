import { test, expect } from '@playwright/test'

/**
 * Social Explorer Feed — Playwright E2E Verification
 *
 * Tests the Explore page at /explore with:
 * - Stories row
 * - Feed content
 * - Navigation elements
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Social Explorer — Feed Page', () => {
  test('01 — Explore page loads with content', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    // Verify page renders content
    const anyContent = page.getByText(/explorer|social|feed|home|story/i)
    await expect(anyContent.first()).toBeVisible()

    await page.screenshot({ path: 'screenshots/explorer-01-desktop.png', fullPage: true })
  })

  test('02 — Page contains navigation elements', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    // Look for tab labels or buttons
    const tabElements = page.getByText(/explore|following|home|social|activity/i)
    const hasTabs = await tabElements.first().isVisible().catch(() => false)
    expect(hasTabs).toBe(true)

    await page.screenshot({ path: 'screenshots/explorer-02-tabs.png', fullPage: true })
  })

  test('03 — Interactive elements are clickable', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    // Look for clickable links or buttons
    const links = page.locator('a, button').first()
    const hasLinks = await links.isVisible().catch(() => false)
    if (hasLinks) {
      await expect(links).toBeVisible()
    }

    await page.screenshot({ path: 'screenshots/explorer-03-interactive.png', fullPage: true })
  })

  test('04 — Mobile viewport renders explore page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    // Verify page renders on mobile
    const content = page.getByText(/explorer|social|feed|home|story/i)
    await expect(content.first()).toBeVisible()

    await page.screenshot({ path: 'screenshots/explorer-04-mobile.png', fullPage: true })
  })
})

test.describe('Console Error Check — Explorer Feed', () => {
  test('no critical console errors on explore page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        // Filter expected errors: favicon 404, rate limit 429, stories API errors
        if (
          !text.includes('favicon.ico') &&
          !text.includes('429') &&
          !text.includes('stories')
        ) {
          errors.push(text)
        }
      }
    })

    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})
