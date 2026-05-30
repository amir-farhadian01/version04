import { test, expect } from '@playwright/test'
import { SEED_USERS, loginViaUI, clearAuth, CLIENT_URL } from './utils/auth.js'

test.describe('Provider Onboarding', () => {
  test.afterEach(async ({ page }) => { await clearAuth(page) })

  test('01-login-as-provider', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.provider.email, SEED_USERS.provider.password)
    await expect(page.getByText(/Good morning|Good afternoon|Good evening/)).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'screenshots/e2e-provider-01-login.png', fullPage: true })
  })

  test('02-business-dashboard', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.provider.email, SEED_USERS.provider.password)
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    const hasBusinessContent = await page.getByText(/Business|Provider|Services|Orders/i).first().isVisible().catch(() => false)
    const hasDashboard = await page.getByText(/Dashboard|Home|Activity/i).first().isVisible().catch(() => false)
    expect(hasBusinessContent || hasDashboard).toBe(true)
    await page.screenshot({ path: 'screenshots/e2e-provider-02-dashboard.png', fullPage: true })
  })
})

test.describe('Provider Onboarding Mobile', () => {
  test('03-mobile-dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginViaUI(page, SEED_USERS.provider.email, SEED_USERS.provider.password)
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    await expect(page.getByText(/Business|Provider|Home|Activity|Dashboard/i).first()).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'screenshots/e2e-provider-03-mobile.png', fullPage: true })
  })
})

test.describe('Provider Onboarding Console', () => {
  test('04-no-console-errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!t.includes('401') && !t.includes('favicon.ico') && !t.includes('429') && !t.includes('stories')) errors.push(t)
      }
    })
    await loginViaUI(page, SEED_USERS.provider.email, SEED_USERS.provider.password)
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})
