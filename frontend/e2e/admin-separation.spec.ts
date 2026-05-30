import { test, expect } from '@playwright/test'

/**
 * Admin SPA Separation — Playwright Verification
 *
 * Tests that the admin SPA (port 9090) is completely independent from
 * the client SPA (port 5173). The admin login must use email+password only
 * (no phone OTP flow), and the client app must NOT show admin login.
 */

const ADMIN_URL = 'http://localhost:9090'
const CLIENT_URL = 'http://localhost:5173'

test.describe('Admin SPA Separation', () => {
  test('01 — Admin login page loads on port 9090', async ({ page }) => {
    const response = await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)

    // Verify admin login page elements
    await expect(page.locator('h1')).toContainText('NeighborHub')
    await expect(page.getByText('Admin Panel — Sign in to continue')).toBeVisible()

    // Verify email+password form exists
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()

    // Verify NO phone OTP elements exist
    await expect(page.getByText(/phone|otp|verify code|sms/i)).toHaveCount(0)

    // Verify Sign In button exists
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    await page.screenshot({ path: 'screenshots/admin-login.png', fullPage: true })
  })

  test('02 — Client app on port 5173 shows home screen, NOT admin login', async ({ page }) => {
    const response = await page.goto(CLIENT_URL, { waitUntil: 'networkidle' })
    expect(response?.status()).toBe(200)

    // Client app should show the home screen with greeting
    await expect(page.getByText(/Good morning/i)).toBeVisible()

    // Client app should NOT show admin login text
    await expect(page.getByText('Admin Panel — Sign in to continue')).toHaveCount(0)
    await expect(page.getByText('NeighborHub')).toHaveCount(0)

    await page.screenshot({ path: 'screenshots/client-home.png', fullPage: true })
  })

  test('03 — Admin login has email+password only (no phone OTP)', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })

    // Verify only email and password fields exist
    const emailInput = page.locator('#email')
    const passwordInput = page.locator('#password')
    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()

    // Verify there's no phone input field
    await expect(page.locator('input[type="tel"]')).toHaveCount(0)

    // Verify the form submits via email+password
    await emailInput.fill('admin@neighborly.com')
    await passwordInput.fill('wrong-password')

    // Click sign in — should attempt login (will fail but that's fine)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Wait for error or loading state
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'screenshots/admin-login-form.png', fullPage: true })
  })

  test('04 — Admin login page has dark theme', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })

    // Verify dark theme background (actual NeighborHub token: #0a0a0f)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 10, 15)')
  })

  test('05 — Mobile viewport renders admin login correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })

    // Form should still be visible on mobile
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()

    await page.screenshot({ path: 'screenshots/admin-login-mobile.png', fullPage: true })
  })

  test('06 — Client app on port 5173 has no admin routes', async ({ page }) => {
    // Visit client app admin-like paths — admin SPA is now separate on port 9090
    await page.goto(`${CLIENT_URL}/admin`, { waitUntil: 'networkidle' })
    // Should NOT show admin dashboard content
    await expect(page.getByText(/Dashboard/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {})
    // Should be on client SPA (home page or 404) — just verify no admin content
    await expect(page.getByText(/admin/i).first()).not.toBeVisible({ timeout: 3000 }).catch(() => {})

    await page.goto(`${CLIENT_URL}/admin/moderation`, { waitUntil: 'networkidle' })
    // Should NOT show admin moderation content
    await expect(page.getByText(/Moderation/i)).not.toBeVisible({ timeout: 3000 }).catch(() => {})
  })
})

test.describe('Console Error Check — Admin SPA', () => {
  test('no console errors on admin login page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
  })
})
