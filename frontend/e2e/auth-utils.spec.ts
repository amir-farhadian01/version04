import { test, expect } from '@playwright/test'
import { clearAuth, CLIENT_URL } from './utils/auth.js'

test('clearAuth establishes an application origin before accessing localStorage', async ({ page }) => {
  expect(page.url()).toBe('about:blank')

  await clearAuth(page)

  expect(page.url()).toBe(`${CLIENT_URL}/`)
  await expect.poll(() => page.evaluate(() => localStorage.getItem('neighborly-auth'))).toBeNull()
})
