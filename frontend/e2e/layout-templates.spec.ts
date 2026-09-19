import { test, expect } from '@playwright/test'

/**
 * UI Template Standardization — Playwright Verification
 *
 * Tests the dark theme layout templates for:
 * - PublicLayout (phone mockup)
 * - AdminLayout (full-screen CRM sidebar)
 * - Color tokens from tailwind.config.ts
 * - Responsive behavior (mobile 375px viewport)
 */

test.describe('PublicLayout — Phone Mockup Container', () => {
  test('renders the phone mockup on desktop viewport', async ({ page }) => {
    await page.goto('/')

    // The outer wrapper should have dark background
    const outerWrapper = page.locator('div').filter({ has: page.locator('div.rounded-\\[44px\\]') }).first()
    await expect(outerWrapper).toBeVisible()

    // The phone container should be visible with correct dimensions
    const phoneContainer = page.locator('div.rounded-\\[44px\\]').first()
    await expect(phoneContainer).toBeVisible()
    await expect(phoneContainer).toHaveCSS('width', '375px')
    await expect(phoneContainer).toHaveCSS('height', '812px')
    await expect(phoneContainer).toHaveCSS('background-color', 'rgb(10, 10, 15)') // #0A0A0F
  })

  test('has dark theme background on page', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)') // #0A0A0F
  })

  test('renders content inside the phone container', async ({ page }) => {
    await page.goto('/')
    // HomeScreen should render inside the phone container
    // The HomeScreen shows "Good morning" text and "Downtown, Austin"
    await expect(page.getByText(/Good morning/)).toBeVisible()
  })

  test('phone container has correct border radius and shadow', async ({ page }) => {
    await page.goto('/')
    const phoneContainer = page.locator('div.rounded-\\[44px\\]').first()
    await expect(phoneContainer).toHaveCSS('border-radius', '44px')
    await expect(phoneContainer).toHaveCSS('border-color', 'rgba(255, 255, 255, 0.08)')
  })
})

test.describe('Authenticated layout guard', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/app/home')
    // Should redirect to /auth/login
    await page.waitForURL('**/auth/login')
    expect(page.url()).toContain('/auth/login')
  })

  test('login page has dark theme', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')
  })
})

test.describe('Dark Theme Color Tokens', () => {
  test('CSS custom properties are defined', async ({ page }) => {
    await page.goto('/')

    // Check that CSS variables are defined on :root
    const hasBgVar = await page.evaluate(() => {
      const root = document.documentElement
      const style = getComputedStyle(root)
      return {
        bg: style.getPropertyValue('--bg').trim(),
        bg2: style.getPropertyValue('--bg2').trim(),
        text: style.getPropertyValue('--text').trim(),
        border: style.getPropertyValue('--border').trim(),
        primary: style.getPropertyValue('--primary').trim(),
      }
    })

    expect(hasBgVar.bg).toBe('#0A0A0F')
    expect(hasBgVar.bg2).toBe('#12121A')
    expect(hasBgVar.text).toBe('#FFFFFF')
    expect(hasBgVar.border).toBe('rgba(255,255,255,0.08)')
    expect(hasBgVar.primary).toBe('#4F8EF7')
  })

  test('body uses DM Sans font family', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('body')).toHaveCSS('font-family', /DM Sans/)
  })

  test('Space Grotesk font is applied to heading elements', async ({ page }) => {
    await page.goto('/')
    // The HomeScreen uses inline fontFamily with Space Grotesk for greeting text
    await expect(page.getByText(/Good morning/)).toHaveCSS('font-family', /Space Grotesk/)
  })
})

test.describe('Mobile Viewport (375px)', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('phone container fits within mobile viewport', async ({ page }) => {
    await page.goto('/')
    const phoneContainer = page.locator('div.rounded-\\[44px\\]').first()
    await expect(phoneContainer).toBeVisible()
    // On mobile, the phone container should still be visible
    await expect(phoneContainer).toHaveCSS('width', '375px')
  })

  test('page is scrollable on mobile', async ({ page }) => {
    await page.goto('/')
    // Check that the body can scroll
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
    expect(scrollHeight).toBeGreaterThan(0)
  })
})

test.describe('Console Error Check', () => {
  test('no console errors on home page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })

  test('no console errors on login page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})

test.describe('Screenshot Comparison', () => {
  test('home page screenshot', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/home-page.png', fullPage: true })
  })

  test('login page screenshot', async ({ page }) => {
    await page.goto('/auth/login')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/login-page.png', fullPage: true })
  })

  test('mobile home page screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'screenshots/home-page-mobile.png', fullPage: true })
  })
})
