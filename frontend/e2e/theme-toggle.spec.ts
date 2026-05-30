import { test, expect } from '@playwright/test'

/**
 * Theme Toggle — Playwright Verification
 *
 * After the NeighborHub redesign (P2.1/P2.2), the app uses dark-only theme
 * with NeighborHub design tokens. There is no theme toggle button.
 * These tests verify the dark theme CSS variables are applied correctly.
 */

test.describe('Theme — Dark Theme Consistency (NeighborHub)', () => {
  test('01 — Home page renders with NeighborHub dark theme CSS variables', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const themeVars = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement)
      return {
        bg: style.getPropertyValue('--bg').trim(),
        bg2: style.getPropertyValue('--bg2').trim(),
        text: style.getPropertyValue('--text').trim(),
        nhBg: style.getPropertyValue('--nh-bg').trim(),
        nhText: style.getPropertyValue('--nh-text').trim(),
      }
    })

    // NeighborHub dark theme values (post-redesign)
    expect(themeVars.bg).toBe('#0A0A0F')
    expect(themeVars.bg2).toBe('#12121A')
    expect(themeVars.text).toBe('#FFFFFF')
    expect(themeVars.nhBg).toBe('#0A0A0F')
    expect(themeVars.nhText).toBe('#FFFFFF')

    await page.screenshot({ path: 'screenshots/nh-dark-theme-home.png', fullPage: true })
  })

  test('02 — Body has NeighborHub dark background', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')
  })

  test('03 — CSS custom properties are defined on :root', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })

    const hasNhTokens = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)
      return {
        '--nh-bg': style.getPropertyValue('--nh-bg').trim().length > 0,
        '--nh-text': style.getPropertyValue('--nh-text').trim().length > 0,
        '--nh-primary': style.getPropertyValue('--nh-primary').trim().length > 0,
        '--nh-bg2': style.getPropertyValue('--nh-bg2').trim().length > 0,
      }
    })

    expect(hasNhTokens['--nh-bg']).toBe(true)
    expect(hasNhTokens['--nh-text']).toBe(true)
  })

  test('04 — Service pages use same dark theme', async ({ page }) => {
    await page.goto('/services', { waitUntil: 'networkidle' })

    const bg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    })
    expect(bg).toBe('#0A0A0F')

    await page.screenshot({ path: 'screenshots/nh-dark-services.png', fullPage: true })
  })

  test('05 — Explore page uses same dark theme', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    const bg = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    })
    expect(bg).toBe('#0A0A0F')

    await page.screenshot({ path: 'screenshots/nh-dark-explore.png', fullPage: true })
  })

  test('06 — Theme persists across page navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')

    await page.goto('/explore', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')

    await page.goto('/services', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')

    await page.goto('/order/wizard', { waitUntil: 'networkidle' })
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')
  })

  test('07 — Mobile viewport uses dark theme', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')

    await page.screenshot({ path: 'screenshots/nh-dark-mobile.png', fullPage: true })
  })
})

test.describe('Console Error Check — Theme', () => {
  test('no console errors on home page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')

    // Filter 401/404 from missing assets or auth checks
    const realErrors = errors.filter(e =>
      !e.includes('401') && !e.includes('404') && !e.includes('Failed to load')
    )
    expect(realErrors).toHaveLength(0)
  })
})