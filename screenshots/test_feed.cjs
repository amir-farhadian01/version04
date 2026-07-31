const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 Pro
  });
  const page = await context.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('1. Opening Flutter app...');
  await page.goto('http://localhost:7357', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/amir/version04/screenshots/feed-01-login.png', fullPage: true });
  console.log('Screenshot 1: Login screen saved');

  // Try to inject a token to skip login and go to social screen directly
  // We'll use localStorage to set a fake token so the app thinks we're logged in
  // First, let's check what localStorage key is used
  const localStorageKeys = await page.evaluate(() => {
    return Object.keys(localStorage);
  });
  console.log('LocalStorage keys:', localStorageKeys);

  // Navigate directly to #/social route
  await page.goto('http://localhost:7357/#/social', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/home/amir/version04/screenshots/feed-02-social-route.png', fullPage: true });
  console.log('Screenshot 2: Social route saved');

  // Get current URL
  console.log('Current URL:', page.url());

  // Check what's visible on screen
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Body text:', bodyText);

  // Try login with test credentials
  await page.goto('http://localhost:7357', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Fill login form if visible
  try {
    await page.fill('input[type="text"]', 'test@test.com', { timeout: 3000 });
    await page.fill('input[type="password"]', 'Test123!', { timeout: 3000 });
    await page.click('button:has-text("Log In")', { timeout: 3000 });
    await page.waitForTimeout(4000);
    await page.screenshot({ path: '/home/amir/version04/screenshots/feed-03-after-login.png', fullPage: true });
    console.log('Screenshot 3: After login attempt saved');
  } catch (e) {
    console.log('Could not fill login form:', e.message);
  }

  // Desktop viewport test
  await context.close();
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:7357', { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(3000);
  await desktopPage.screenshot({ path: '/home/amir/version04/screenshots/feed-04-desktop.png', fullPage: true });
  console.log('Screenshot 4: Desktop view saved');

  console.log('Console errors:', errors);
  await browser.close();
})();
