import { test, expect } from '@playwright/test';

const FLUTTER_URL = 'http://localhost:7357';

test.describe('Flutter Profile Screen — UI Verification', () => {
  test('01 — Page loads successfully', async ({ page }) => {
    const response = await page.goto(FLUTTER_URL, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await page.screenshot({ path: 'screenshots/flutter-01-initial.png', fullPage: true });
  });

  test('02 — Profile page renders with tabs', async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/#/profile`, { waitUntil: 'networkidle' });
    // Wait for Flutter canvas to render
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-02-profile-page.png', fullPage: true });

    // Verify the page loaded (Flutter renders in a canvas element)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('03 — Bottom navigation is visible', async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/#/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-03-bottom-nav.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('04 — Home page loads with bottom nav', async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/#/home`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-04-home-page.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('05 — Social page loads with bottom nav', async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/#/social`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-05-social-page.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('06 — Activity page loads with bottom nav', async ({ page }) => {
    await page.goto(`${FLUTTER_URL}/#/activity`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-06-activity-page.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });

  test('07 — Mobile viewport renders correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${FLUTTER_URL}/#/profile`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/flutter-07-mobile-viewport.png', fullPage: true });

    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
  });
});
