import { test, expect } from '@playwright/test';

const FLUTTER_URL = 'http://localhost:7357';

test.describe('Flutter Profile Screen — UI Verification', () => {
  test('01 — Page loads successfully', async ({ page }) => {
    const response = await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);
    // Flutter renders inside a canvas
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'screenshots/flutter-01-initial.png', fullPage: true });
  });

  test('02 — Flutter canvas renders on home page', async ({ page }) => {
    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Flutter web renders in a canvas element
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'screenshots/flutter-02-canvas.png', fullPage: true });
  });

  test('03 — App title is correct', async ({ page }) => {
    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('neighborly_app');
  });

  test('04 — Page body has content', async ({ page }) => {
    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Flutter app should render inside the body
    const bodyContent = await page.locator('body').innerText();
    expect(bodyContent.length).toBeGreaterThan(0);
  });

  test('05 — Mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'screenshots/flutter-05-mobile.png', fullPage: true });
  });

  test('06 — No console errors on page load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Filter out Flutter's own debug/info messages that might appear as errors
    const realErrors = errors.filter(e =>
      !e.includes('sourcemap') && !e.includes('SourceMap')
    );
    expect(realErrors).toHaveLength(0);
  });

  test('07 — Canvas element exists after page load', async ({ page }) => {
    await page.goto(FLUTTER_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    const canvasCount = await page.locator('canvas').count();
    expect(canvasCount).toBeGreaterThan(0);
  });
});