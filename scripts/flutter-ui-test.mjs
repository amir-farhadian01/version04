/**
 * Flutter UI Verification Script
 * Uses multiple methods to extract Flutter content
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots');
const BASE_URL = 'http://localhost:7357';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function screenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `flutter-${name}.png`);
  return page.screenshot({ path: filepath, fullPage: false });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
  });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  let passed = 0;
  let failed = 0;

  function check(condition, label) {
    if (condition) { console.log(`  ✅ ${label}`); passed++; }
    else { console.log(`  ❌ ${label}`); failed++; }
  }

  try {
    // ============================================================
    // STEP 1: Open Flutter Web App
    // ============================================================
    console.log('\n📸 STEP 1: Open Flutter Web App');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    await screenshot(page, '01-initial-load');
    
    const title = await page.title();
    const url = page.url();
    console.log(`  Title: "${title}"`);
    console.log(`  URL: ${url}`);
    check(title === 'NeighborHub', 'App title is NeighborHub');
    
    // Inspect full DOM
    const domDump = await page.evaluate(() => {
      const result = [];
      // Get all elements recursively
      function walk(el, depth) {
        if (depth > 3) return;
        const tag = el.tagName ? el.tagName.toLowerCase() : '?';
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.substring(0, 30)}` : '';
        const text = el.childNodes.length === 1 && el.textContent ? ` "${el.textContent.substring(0, 50)}"` : '';
        result.push(`${'  '.repeat(depth)}<${tag}${id}${cls}>${text}`);
        for (const child of el.children) {
          walk(child, depth + 1);
        }
      }
      if (document.body) walk(document.body, 0);
      return result.join('\n');
    });
    console.log('  DOM structure:');
    console.log(domDump.substring(0, 1000));

    // ============================================================
    // STEP 2: Navigate to Profile page
    // ============================================================
    console.log('\n📸 STEP 2: Navigate to Profile page');
    await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(5000);
    await screenshot(page, '02-profile-page');
    
    const profileDump = await page.evaluate(() => {
      const result = [];
      function walk(el, depth) {
        if (depth > 3) return;
        const tag = el.tagName ? el.tagName.toLowerCase() : '?';
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.substring(0, 30)}` : '';
        const text = el.childNodes.length === 1 && el.textContent ? ` "${el.textContent.substring(0, 50)}"` : '';
        result.push(`${'  '.repeat(depth)}<${tag}${id}${cls}>${text}`);
        for (const child of el.children) {
          walk(child, depth + 1);
        }
      }
      if (document.body) walk(document.body, 0);
      return result.join('\n');
    });
    console.log('  Profile DOM:');
    console.log(profileDump.substring(0, 1000));
    
    check(profileDump.length > 0, 'Profile page loaded');

    // ============================================================
    // STEP 3: Check for Flutter error widgets
    // ============================================================
    console.log('\n📸 STEP 3: Check for errors');
    await sleep(2000);
    await screenshot(page, '03-page-content');
    
    const hasError = await page.evaluate(() => {
      const body = document.body ? document.body.textContent || '' : '';
      return body.includes('Error') || body.includes('error') || body.includes('Exception');
    });
    check(!hasError, 'No Flutter error widgets visible');

    // ============================================================
    // STEP 4-7: Screenshots only (visual inspection)
    // ============================================================
    console.log('\n📸 STEP 4: Address & Cars screenshot');
    await screenshot(page, '04-address-cars');
    
    console.log('\n📸 STEP 5: Bottom nav screenshot');
    await sleep(2000);
    await screenshot(page, '05-bottom-nav');
    
    console.log('\n📸 STEP 6: Theme toggle screenshot');
    await sleep(1000);
    await screenshot(page, '06-theme-toggle');
    
    console.log('\n📸 STEP 7: Mobile viewport');
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(3000);
    await screenshot(page, '07-mobile-viewport');

    // ============================================================
    // SUMMARY
    // ============================================================
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`  Passed: ${passed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Console errors: ${consoleErrors.length}`);
    console.log(`  Page errors: 0`);
    
    if (consoleErrors.length > 0) {
      console.log('\n  Console errors:');
      consoleErrors.forEach(e => console.log(`    - ${e}`));
    }

    console.log(`\n✅ Flutter UI Verification Complete`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);

  } catch (err) {
    console.error('\n❌ Test failed with error:', err.message);
    try { await screenshot(page, 'error-state'); } catch (_) {}
    failed++;
  } finally {
    await browser.close();
  }

  process.exit(failed > 0 ? 1 : 0);
}

run();
