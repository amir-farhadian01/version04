import { test, expect } from "@playwright/test"
import { SEED_USERS, registerTestUser, API_BASE, CLIENT_URL } from "./utils/auth.js"
import { deleteUserById } from "./utils/cleanup.js"

test.describe("Auth Register + Admin", () => {
  let testUserId: string | null = null
  let ownerToken: string | null = null

  test.beforeAll(async ({ request }) => {
    const a = await request.post(API_BASE + "/auth/login", {
      data: { login: SEED_USERS.owner.email, password: SEED_USERS.owner.password },
    })
    if (a.ok()) { const j = await a.json(); ownerToken = j.accessToken }
  })

  test.afterAll(async ({ request }) => {
    if (testUserId && ownerToken) await deleteUserById(request, ownerToken, testUserId)
  })

  test("register user via API", async ({ request }) => {
    const { email, password, userId, token } = await registerTestUser(request)
    testUserId = userId
    expect(userId).toBeTruthy()
    expect(token).toBeTruthy()
    const me = await request.get(API_BASE + "/auth/me", { headers: { Authorization: "Bearer " + token } })
    expect(me.ok()).toBe(true)
    expect((await me.json()).email).toBe(email)
  })

  test("admin login page loads", async ({ page }) => {
    const r = await page.goto("http://localhost:9090/login", { waitUntil: "networkidle" })
    expect(r?.status()).toBe(200)
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible()
    await page.screenshot({ path: "screenshots/e2e-auth-admin.png", fullPage: true })
  })

  test("mobile login", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(CLIENT_URL + "/auth/login", { waitUntil: "networkidle" })
    await page.waitForSelector("input[type="email"]", { timeout: 10000 })
    await page.locator("input[type="email"]").fill(SEED_USERS.customer.email)
    await page.locator("input[type="password"]").fill(SEED_USERS.customer.password)
    await page.getByRole("button", { name: /sign in|login/i }).click()
    await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 15000 })
    await expect(page.getByText(/Good morning|Good afternoon|Good evening/)).toBeVisible({ timeout: 10000 })
    await page.screenshot({ path: "screenshots/e2e-auth-mobile.png", fullPage: true })
  })

  test("console errors", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") { const t = msg.text(); if (!t.includes("401") && !t.includes("429")) errors.push(t) }
    })
    await page.goto(CLIENT_URL + "/auth/login", { waitUntil: "networkidle" })
    await page.waitForSelector("input[type="email"]", { timeout: 10000 })
    await page.locator("input[type="email"]").fill(SEED_USERS.customer.email)
    await page.locator("input[type="password"]").fill(SEED_USERS.customer.password)
    await page.getByRole("button", { name: /sign in|login/i }).click()
    await page.waitForURL((u) => !u.pathname.includes("/auth/login"), { timeout: 15000 })
    await page.goto(CLIENT_URL + "/explore", { waitUntil: "networkidle" })
    await page.waitForLoadState("networkidle")
    expect(errors).toHaveLength(0)
  })
})
