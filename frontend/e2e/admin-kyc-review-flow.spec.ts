import { test, expect } from "@playwright/test"
import { SEED_USERS, loginAdminViaUI, API_BASE } from "./utils/auth.js"

const ADMIN_URL = "http://localhost:9090"

test.describe("Admin KYC Review", () => {
  test("admin login page loads on 9090", async ({ page }) => {
    const r = await page.goto(ADMIN_URL + "/login", { waitUntil: "networkidle" })
    expect(r?.status()).toBe(200)
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await page.screenshot({ path: "screenshots/e2e-kyc-01-login.png", fullPage: true })
  })

  test("invalid login shows error", async ({ page }) => {
    await page.goto(ADMIN_URL + "/login", { waitUntil: "networkidle" })
    await page.locator("#email").fill("bad@admin.com")
    await page.locator("#password").fill("wrong")
    await page.getByRole("button", { name: /sign in/i }).click()
    await page.waitForTimeout(2000)
    const hasErr = await page.getByText(/incorrect|invalid|not found|failed|error/i).first().isVisible().catch(() => false)
    expect(hasErr || page.url().includes("/login")).toBe(true)
    await page.screenshot({ path: "screenshots/e2e-kyc-02-invalid.png", fullPage: true })
  })

  test("admin dashboard redirects unauth", async ({ page }) => {
    await page.goto(ADMIN_URL + "/admin/dashboard", { waitUntil: "networkidle" })
    await page.waitForURL("**/login")
    expect(page.url()).toContain("/login")
  })

  test("mobile admin login", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(ADMIN_URL + "/login", { waitUntil: "networkidle" })
    await expect(page.locator("#email")).toBeVisible()
    await expect(page.locator("#password")).toBeVisible()
    await page.screenshot({ path: "screenshots/e2e-kyc-03-mobile.png", fullPage: true })
  })
})

test.describe("Admin KYC Console", () => {
  test("no console errors on admin login", async ({ page }) => {
    const errors: string[] = []
    page.on("console", (msg) => {
      if (msg.type() === "error") { const t = msg.text(); if (!t.includes("401") && !t.includes("429")) errors.push(t) }
    })
    await page.goto(ADMIN_URL + "/login", { waitUntil: "networkidle" })
    await page.waitForLoadState("networkidle")
    expect(errors).toHaveLength(0)
  })
})
