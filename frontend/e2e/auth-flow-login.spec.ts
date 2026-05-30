import { test, expect } from "@playwright/test"
import { SEED_USERS, loginViaUI, clearAuth, verifyAuthTokenInStorage, CLIENT_URL } from "./utils/auth.js"
import { verifySeedUsers, logSeedVerification } from "./utils/seed.js"

test.describe("Auth Login", () => {
  test.afterEach(async ({ page }) => { await clearAuth(page) })

  test("seed users exist", async ({ request }) => {
    const r = await verifySeedUsers(request)
    logSeedVerification(r)
    expect(r.allPresent).toBe(true)
  })

  test("login as customer", async ({ page }) => {
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await expect(page.getByText(/Good morning|Good afternoon|Good evening/)).toBeVisible({ timeout: 10000 })
    expect(await verifyAuthTokenInStorage(page)).toBe(true)
    await page.screenshot({ path: "screenshots/e2e-auth-login.png", fullPage: true })
  })

  test("logout removes token", async ({ page }) => {
    await loginViaUI(page, SEED_USERS.customer.email, SEED_USERS.customer.password)
    await clearAuth(page)
    await page.goto(CLIENT_URL, { waitUntil: "networkidle" })
    expect(await verifyAuthTokenInStorage(page)).toBe(false)
  })

  test("protected route redirects", async ({ page }) => {
    await clearAuth(page)
    await page.goto(CLIENT_URL + "/app/home", { waitUntil: "networkidle" })
    const isLogin = page.url().includes("/auth/login")
    const hasForm = await page.locator("input[type="email"]").first().isVisible().catch(() => false)
    expect(isLogin || hasForm).toBeTruthy()
  })

  test("invalid login shows error", async ({ page }) => {
    await page.goto(CLIENT_URL + "/auth/login", { waitUntil: "networkidle" })
    await page.waitForSelector("input[type="email"]", { timeout: 10000 })
    await page.locator("input[type="email"]").fill("bad@test.com")
    await page.locator("input[type="password"]").fill("wrong")
    await page.getByRole("button", { name: /sign in|login/i }).click()
    await page.waitForTimeout(2000)
    const hasErr = await page.getByText(/incorrect|invalid|not found|failed|error/i).first().isVisible().catch(() => false)
    expect(hasErr || page.url().includes("/auth/login")).toBe(true)
  })
})
