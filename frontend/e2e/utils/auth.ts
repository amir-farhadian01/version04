import { Page, APIRequestContext } from '@playwright/test'

/**
 * Shared auth utilities for E2E tests.
 * Uses real API calls to the backend — no mock tokens.
 */

const API_BASE = 'http://localhost:8080/api'
const CLIENT_URL = 'http://localhost:5173'
const ADMIN_URL = 'http://localhost:9090'

// Seed credentials (must match prisma/seed.ts)
export const SEED_USERS = {
  customer: { email: 'customer@neighborly.local', password: '12345678', role: 'customer' },
  provider: { email: 'provider@neighborly.local', password: '12345678', role: 'provider' },
  owner: { email: 'owner@neighborly.local', password: '12345678', role: 'owner' },
} as const

export type SeedUser = keyof typeof SEED_USERS

export interface AuthResult {
  token: string
  userId: string
  email: string
  displayName: string
  role: string
}

/**
 * Authenticate via the real API and return the access token + user info.
 * Uses Playwright's built-in APIRequestContext (not page.route mocks).
 */
export async function authenticateViaApi(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<AuthResult> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { login: email, password },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Auth failed for ${email}: ${res.status()} ${body}`)
  }

  const json = await res.json()
  return {
    token: json.accessToken,
    userId: json.user.id,
    email: json.user.email,
    displayName: json.user.displayName,
    role: json.user.role,
  }
}

/**
 * Authenticate via the real API and return Playwright APIRequestContext with auth header set.
 */
export async function createAuthContext(
  playwrightRequest: APIRequestContext,
  email: string,
  password: string,
): Promise<{ token: string; user: AuthResult }> {
  const auth = await authenticateViaApi(playwrightRequest, email, password)
  return { token: auth.token, user: auth }
}

/**
 * Log in a seed user via the browser UI (client SPA on port 5173).
 * Navigates to login page, fills credentials, submits, and waits for redirect.
 */
export async function loginViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${CLIENT_URL}/auth/login`, { waitUntil: 'networkidle' })

  // Wait for login form
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })

  // Fill credentials
  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)

  // Click sign in
  await page.getByRole('button', { name: /sign in|login/i }).click()

  // Wait for redirect away from login page
  await page.waitForURL((url) => !url.pathname.includes('/auth/login'), { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Log in an admin user via the admin SPA UI (port 9090).
 */
export async function loginAdminViaUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${ADMIN_URL}/login`, { waitUntil: 'networkidle' })

  // Wait for login form
  await page.waitForSelector('#email', { timeout: 10000 })

  // Fill credentials
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)

  // Click sign in
  await page.getByRole('button', { name: /sign in/i }).click()

  // Wait for redirect to admin dashboard
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Check if localStorage contains a valid auth token after login.
 */
export async function verifyAuthTokenInStorage(page: Page, storageKey: string = 'neighborly-auth'): Promise<boolean> {
  const storage = await page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }, storageKey)

  return !!(storage?.state?.token)
}

/**
 * Clear auth from localStorage.
 */
export async function clearAuth(page: Page, storageKey: string = 'neighborly-auth'): Promise<void> {
  await page.evaluate((key) => {
    localStorage.removeItem(key)
  }, storageKey)
}

/**
 * Register a new test user via the API and return credentials.
 * The user will be cleaned up after the test.
 */
export async function registerTestUser(
  request: APIRequestContext,
  suffix = Date.now().toString(36),
): Promise<{ email: string; password: string; userId: string; token: string }> {
  const email = `e2e-test-${suffix}@neighborly.test`
  const password = 'TestPass123!'

  const res = await request.post(`${API_BASE}/auth/register`, {
    data: {
      email,
      password,
      displayName: `E2E Test ${suffix}`,
      phone: `+1-555-${suffix.slice(-7)}`,
      role: 'customer',
    },
  })

  if (!res.ok()) {
    const body = await res.text()
    throw new Error(`Registration failed: ${res.status()} ${body}`)
  }

  const json = await res.json()
  return {
    email,
    password,
    userId: json.user.id,
    token: json.accessToken,
  }
}

export { API_BASE, CLIENT_URL, ADMIN_URL }