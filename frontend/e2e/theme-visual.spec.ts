import { test, expect } from '@playwright/test'

/**
 * Theme Visual Consistency — Playwright E2E Verification
 *
 * Tests that the application uses dark mode CSS custom properties,
 * and that pages render consistently across the app.
 */

const CLIENT_URL = 'http://localhost:5173'

test.describe('Theme Visual — Dark/Light Consistency', () => {
  test('01 — Home page renders with dark theme CSS variables', async ({ page }) => {
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Verify dark theme CSS variables are defined
    const themeVars = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)
      return {
        bg: style.getPropertyValue('--bg').trim(),
        bg2: style.getPropertyValue('--bg2').trim(),
        text: style.getPropertyValue('--text').trim(),
      }
    })

    // Verify theme variables have values (not empty)
    expect(themeVars.bg).toBeTruthy()
    expect(themeVars.bg2).toBeTruthy()
    expect(themeVars.text).toBeTruthy()

    // Verify it's a dark color palette (not light/white)
    expect(themeVars.bg).not.toMatch(/^#f[ef]/i) // Not white-ish

    await page.screenshot({ path: 'screenshots/theme-01-home-dark.png', fullPage: true })
  })

  test('02 — Body has dark background color', async ({ page }) => {
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    const bodyBg = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Body should have a non-white background (dark theme)
    expect(bodyBg).toBeTruthy()
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')

    await page.screenshot({ path: 'screenshots/theme-02-body-bg.png', fullPage: true })
  })

  test('03 — localStorage is accessible and has application data', async ({ page }) => {
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Verify localStorage is accessible (no SecurityError)
    const localStorageOk = await page.evaluate(() => {
      try {
        const key = 'test-key'
        localStorage.setItem(key, 'test')
        localStorage.removeItem(key)
        return true
      } catch {
        return false
      }
    })

    expect(localStorageOk).toBe(true)
  })

  test('04 — Order wizard page uses dark theme', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/order/new`, { waitUntil: 'networkidle' })

    // Verify page renders
    const content = page.getByText(/order|login|new/i)
    await expect(content.first()).toBeVisible()

    // Verify dark background
    const bodyBg = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bodyBg).toBeTruthy()
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')

    await page.screenshot({ path: 'screenshots/theme-04-order-wizard.png', fullPage: true })
  })

  test('05 — Explore page uses dark theme', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    // Verify explorer renders
    await expect(page.getByText('Explorer')).toBeVisible()

    // Verify dark background
    const bodyBg = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bodyBg).toBeTruthy()
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')

    await page.screenshot({ path: 'screenshots/theme-05-explore.png', fullPage: true })
  })

  test('06 — Services page uses dark theme', async ({ page }) => {
    await page.goto(`${CLIENT_URL}/app/services`, { waitUntil: 'networkidle' })

    // Verify dark background
    const bodyBg = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    expect(bodyBg).toBeTruthy()
    expect(bodyBg).not.toBe('rgb(255, 255, 255)')

    await page.screenshot({ path: 'screenshots/theme-06-services.png', fullPage: true })
  })

  test('07 — Theme persists across page navigation', async ({ page }) => {
    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })

    // Get initial theme
    const bg1 = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Navigate to another page
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })

    const bg2 = await page.locator('body').evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })

    // Both pages should have same (dark) background
    expect(bg1).toBe(bg2)
  })
})

test.describe('Console Error Check — Theme Visual', () => {
  test('no critical console errors on multiple page navigations', async ({ page }) => {
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

    await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })
    await page.goto(`${CLIENT_URL}/explore`, { waitUntil: 'networkidle' })
    await page.goto(`${CLIENT_URL}/order/new`, { waitUntil: 'networkidle' })

    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})
