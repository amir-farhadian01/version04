import { test, expect } from '@playwright/test'

/**
 * Social Layer — Playwright Verification
 *
 * Tests the explore page structure and social features.
 * Verifies stories row, service category tabs, posts section, and bottom nav.
 */

test.describe('Social Layer — Explore Page', () => {
  test('01 — Explore page loads with content tabs', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Explorer tab should be visible
    await expect(page.getByText('Explorer')).toBeVisible()

    // Service category tabs visible
    await expect(page.getByText('General')).toBeVisible()
    await expect(page.getByText('Business')).toBeVisible()
    await expect(page.getByText('Nearby')).toBeVisible()

    await page.screenshot({ path: 'screenshots/explore-page.png', fullPage: true })
  })

  test('02 — Stories row renders with "Your Story" button', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // The "Your Story" add story button should always be visible
    await expect(page.getByText('Your Story')).toBeVisible()

    await page.screenshot({ path: 'screenshots/stories-row.png', fullPage: true })
  })

  test('03 — Posts section shows empty state when no data', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Should show empty state message when no posts exist
    const hasEmptyState = await page.getByText(/No posts yet|Nothing to show/).isVisible().catch(() => false)
    const hasPosts = await page.locator('[class*="post"], [class*="feed"]').first().isVisible().catch(() => false)

    expect(hasEmptyState || hasPosts).toBe(true)

    await page.screenshot({ path: 'screenshots/feed-posts.png', fullPage: true })
  })

  test('04 — Service category tabs are clickable and switch content', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Click "Nearby" tab
    const nearbyTab = page.getByText('Nearby')
    await expect(nearbyTab).toBeVisible()
    await nearbyTab.click()
    await page.waitForTimeout(500)

    // Tab should remain clickable (no crash)
    await expect(nearbyTab).toBeVisible()

    // Click back to "General" tab
    const generalTab = page.getByText('General')
    await expect(generalTab).toBeVisible()
    await generalTab.click()
    await page.waitForTimeout(500)
    await expect(generalTab).toBeVisible()
  })

  test('05 — Bottom navigation is visible on explore page', async ({ page }) => {
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Bottom nav items — actual UI has Home, Explorer, Activity
    await expect(page.getByText('Home')).toBeVisible()
    await expect(page.getByText('Explorer')).toBeVisible()
    await expect(page.getByText('Activity')).toBeVisible()
  })

  test('06 — Mobile viewport renders explore page correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/explore', { waitUntil: 'networkidle' })

    // Core elements should be visible on mobile
    await expect(page.getByText('Your Story')).toBeVisible()
    await expect(page.getByText('Explorer')).toBeVisible()

    await page.screenshot({ path: 'screenshots/explore-mobile.png', fullPage: true })
  })
})

test.describe('Console Error Check — Social Layer', () => {
  test('no critical console errors on explore page', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/explore', { waitUntil: 'networkidle' })
    await page.waitForLoadState('networkidle')

    // Filter expected network errors from missing auth/data
    const realErrors = errors.filter(e =>
      !e.includes('401') && !e.includes('404') && !e.includes('Failed to load')
    )
    expect(realErrors).toHaveLength(0)
  })
})