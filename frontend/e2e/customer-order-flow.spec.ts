import { test, expect } from '@playwright/test'
import { SEED_USERS, loginViaUI, clearAuth, CLIENT_URL } from './utils/auth.js'

test.describe('Customer Order', () => {
  test.afterEach(async ({ page }) => { await clearAuth(page) })

  test('01-explore', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await page.goto(CLIENT_URL + '/explore', { waitUntil: 'networkidle' })
    expect(await page.locator('#root').innerText()).toBeTruthy()
    await page.screenshot({ path: 'screenshots/e2e-order-explore.png', fullPage: true })
  })

  test('02-wizard', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await page.goto(CLIENT_URL + '/order/new', { waitUntil: 'networkidle' })
    const w = await page.getByText(/New.*Order|Category|Service|Step/i).first().isVisible().catch(() => false)
    expect(w).toBe(true)
    await page.screenshot({ path: 'screenshots/e2e-order-wizard.png', fullPage: true })
  })

  test('03-dashboard', async ({ page }) => {
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    const o = await page.getByText(/My Orders|Active Orders|Past Orders|No orders/i).first().isVisible().catch(() => false)
    expect(o).toBe(true)
    await page.screenshot({ path: 'screenshots/e2e-order-dashboard.png', fullPage: true })
  })

  test('04-mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    await expect(page.getByText(/My Orders|Active|Past|No orders/i).first()).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: 'screenshots/e2e-order-mobile.png', fullPage: true })
  })

  test('05-console', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const t = msg.text()
        if (!t.includes('401') && !t.includes('favicon.ico') && !t.includes('429') && !t.includes('stories')) errors.push(t)
      }
    })
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await page.goto(CLIENT_URL + '/explore', { waitUntil: 'networkidle' })
    await page.goto(CLIENT_URL + '/app/home', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')
    expect(errors).toHaveLength(0)
  })
})
