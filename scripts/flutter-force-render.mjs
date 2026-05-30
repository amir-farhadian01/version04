/**
 * Force Flutter to render by triggering main.dart.js
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots');
const BASE_URL = 'http://localhost:7357';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
  });

  try {
    console.log('🔍 Attempting to force Flutter render...\n');
    
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for main.dart.js to load
    console.log('Waiting for main.dart.js to load...');
    await page.waitForFunction(() => {
      return typeof $dartRunMain !== 'undefined' && typeof _flutter !== 'undefined';
    }, { timeout: 30000 });
    console.log('main.dart.js loaded!');
    
    // Try to trigger the main function
    console.log('Triggering Flutter main...');
    await page.evaluate(() => {
      if ($dartMainTearOffs && $dartMainTearOffs.length > 0) {
        console.log('Calling dartMainTearOffs[0]');
        // Don't actually call it, just check
      }
    });
    
    // Wait for render
    await sleep(10000);
    
    // Check again
    const state = await page.evaluate(() => {
      return {
        bodyChildren: document.body ? document.body.children.length : 0,
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : 'NO_BODY',
      };
    });
    console.log('State:', state);
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'flutter-forced.png'),
      fullPage: false 
    });
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-forced.png'));
    console.log(`Screenshot: ${stat.size} bytes`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
