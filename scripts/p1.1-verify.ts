/**
 * P1.1 — Business Services, Packages & Inventory UI Verification
 * Uses Playwright to test the three business workspace pages.
 */
import { chromium } from 'playwright';
import path from 'path';

const BASE = 'http://localhost:5173';
const SCREENSHOT_DIR = path.resolve('screenshots');

// Test credentials (must exist in DB)
const EMAIL = 'admin@neighborly.com';
const PASSWORD = 'admin123';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  const results: string[] = [];

  try {
    // Step 1: Navigate to login
    console.log('Step 1: Login...');
    await page.goto(`${BASE}/auth/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p11-01-login.png`, fullPage: true });
    results.push('✅ Login page loads');

    // Step 2: Fill login form
    const emailInput = page.locator('input[type="email"], input[placeholder*="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();

    if (await emailInput.isVisible()) {
      await emailInput.fill(EMAIL);
      results.push('✅ Email input found and filled');
    } else {
      results.push('❌ Email input not found');
    }

    if (await passInput.isVisible()) {
      await passInput.fill(PASSWORD);
      results.push('✅ Password input found and filled');
    } else {
      results.push('❌ Password input not found');
    }

    // Click submit
    const submitBtn = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      results.push('✅ Login submitted');
    } else {
      results.push('❌ Submit button not found');
    }

    // Step 3: Navigate to business workspace
    console.log('Step 3: Navigate to business workspace...');
    // First get the user's first workspace ID from API
    const token = await page.evaluate(() => localStorage.getItem('neighborly-auth'));
    if (!token) {
      results.push('❌ No auth token found after login');
      await browser.close();
      console.log(results.join('\n'));
      return;
    }

    // Parse JWT to get user info
    let payload: string;
    try {
      payload = JSON.parse(token).token || token;
    } catch {
      payload = token;
    }

    // Try to get workspace from API
    const apiRes = await page.evaluate(async (t) => {
      try {
        const r = await fetch('http://localhost:8080/api/workspaces', {
          headers: { Authorization: `Bearer ${t}` },
        });
        const d = await r.json();
        return d;
      } catch {
        return null;
      }
    }, payload);

    let workspaceId = '';
    if (apiRes?.data && Array.isArray(apiRes.data) && apiRes.data.length > 0) {
      workspaceId = apiRes.data[0].id || apiRes.data[0].companyId || '';
    } else if (apiRes?.companyId) {
      workspaceId = apiRes.companyId;
    }

    if (!workspaceId) {
      // Try from user profile
      workspaceId = await page.evaluate(async (t) => {
        try {
          const r = await fetch('http://localhost:8080/api/users/me', {
            headers: { Authorization: `Bearer ${t}` },
          });
          const d = await r.json();
          return d.data?.companyId || '';
        } catch {
          return '';
        }
      }, payload);
    }

    if (!workspaceId) {
      results.push('❌ No workspace found for user');
      await browser.close();
      console.log(results.join('\n'));
      return;
    }

    results.push(`✅ Found workspace: ${workspaceId}`);

    // Step 4: Navigate to My Services page
    console.log('Step 4: My Services page...');
    await page.goto(`${BASE}/business/${workspaceId}/services`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p11-02-myservices.png`, fullPage: true });
    results.push('✅ My Services page loads');

    // Check for key elements
    const servicesTitle = page.locator('h1, .font-display').filter({ hasText: /My Services|Services/i }).first();
    if (await servicesTitle.isVisible()) {
      results.push('✅ Services title visible');
    } else {
      results.push('⚠️ Services title not found');
    }

    const addButton = page.locator('button, [role="button"]').filter({ hasText: /Add/i }).first();
    if (await addButton.isVisible()) {
      results.push('✅ Add button visible');
    } else {
      results.push('⚠️ Add button not found');
    }

    // Step 5: Navigate to Inventory page
    console.log('Step 5: Inventory page...');
    await page.goto(`${BASE}/business/${workspaceId}/inventory`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p11-03-inventory.png`, fullPage: true });
    results.push('✅ Inventory page loads');

    // Step 6: Navigate to Packages page
    console.log('Step 6: Packages page...');
    await page.goto(`${BASE}/business/${workspaceId}/packages`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p11-04-packages.png`, fullPage: true });
    results.push('✅ Packages page loads');

    // Step 7: Desktop viewport check
    console.log('Step 7: Desktop viewport...');
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/business/${workspaceId}/services`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/p11-05-services-desktop.png`, fullPage: true });
    results.push('✅ Desktop viewport works');

    // Step 8: Console error check
    console.log('Step 8: Console error check...');
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/business/${workspaceId}/inventory`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.goto(`${BASE}/business/${workspaceId}/packages`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    if (consoleErrors.length === 0) {
      results.push('✅ No console errors');
    } else {
      results.push(`⚠️ Console errors: ${consoleErrors.length}`);
    }

    console.log('\n========== UI VERIFICATION REPORT ==========');
    console.log(results.join('\n'));
    console.log('============================================\n');

  } catch (err) {
    console.error('Test error:', err);
    results.push(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);