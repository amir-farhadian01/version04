/**
 * Flutter Screenshot Script
 * Uses headed mode with xvfb for WebGL/CanvasKit support
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots');
const BASE_URL = 'http://localhost:7357';

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  // Use headed mode with xvfb for WebGL support
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ]
  });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
  });

  console.log('📸 Flutter Screenshot Capture (headed mode via xvfb)');
  console.log('='.repeat(50));

  try {
    // Screenshot 1: Home page
    console.log('\n1. Home page...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(10000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-home.png'), fullPage: false });
    const s1 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-home.png'));
    console.log(`   Saved: flutter-home.png (${s1.size} bytes)`);

    // Screenshot 2: Profile page
    console.log('2. Profile page...');
    await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(10000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-profile.png'), fullPage: false });
    const s2 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-profile.png'));
    console.log(`   Saved: flutter-profile.png (${s2.size} bytes)`);

    // Screenshot 3: Social page
    console.log('3. Social page...');
    await page.goto(`${BASE_URL}/#/social`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-social.png'), fullPage: false });
    const s3 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-social.png'));
    console.log(`   Saved: flutter-social.png (${s3.size} bytes)`);

    // Screenshot 4: Activity page
    console.log('4. Activity page...');
    await page.goto(`${BASE_URL}/#/activity`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-activity.png'), fullPage: false });
    const s4 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-activity.png'));
    console.log(`   Saved: flutter-activity.png (${s4.size} bytes)`);

    // Screenshot 5: Dashboard page
    console.log('5. Dashboard page...');
    await page.goto(`${BASE_URL}/#/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-dashboard.png'), fullPage: false });
    const s5 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-dashboard.png'));
    console.log(`   Saved: flutter-dashboard.png (${s5.size} bytes)`);

    // Screenshot 6: Business profile page
    console.log('6. Business profile page...');
    await page.goto(`${BASE_URL}/#/business`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-business.png'), fullPage: false });
    const s6 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-business.png'));
    console.log(`   Saved: flutter-business.png (${s6.size} bytes)`);

    // Screenshot 7: Mobile viewport
    console.log('7. Mobile viewport (375x812)...');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(10000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-mobile.png'), fullPage: false });
    const s7 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-mobile.png'));
    console.log(`   Saved: flutter-mobile.png (${s7.size} bytes)`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ All 7 screenshots captured!');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
