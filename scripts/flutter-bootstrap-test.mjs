/**
 * Load Flutter bootstrap manually
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

  // Collect ALL console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    console.log('🔍 Loading Flutter with bootstrap...\n');
    
    // Navigate and wait for load event
    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 30000 });
    console.log('Page load event fired');
    
    // Wait for bootstrap to execute
    await sleep(3000);
    
    // Check if bootstrap loaded
    const bootstrapLoaded = await page.evaluate(() => {
      return {
        hasFlutter: typeof _flutter !== 'undefined',
        bootstrapScript: document.querySelector('script[src*="bootstrap"]')?.getAttribute('src'),
        engineInitialized: _flutter?.engineInitialized,
        loaderInitialized: _flutter?.loaderInitialized,
      };
    });
    console.log('Bootstrap state:', JSON.stringify(bootstrapLoaded, null, 2));
    
    // Wait more
    console.log('\nWaiting 20 more seconds for Flutter to render...');
    await sleep(20000);
    
    const finalState = await page.evaluate(() => {
      return {
        bodyChildren: document.body ? document.body.children.length : 0,
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 1000) : 'NO_BODY',
        hasCanvas: !!document.querySelector('canvas'),
        hasFltScene: !!document.querySelector('flt-scene-host'),
        hasFltView: !!document.querySelector('flutter-view'),
        engineInitialized: _flutter?.engineInitialized,
        loaderInitialized: _flutter?.loaderInitialized,
      };
    });
    console.log('Final state:', JSON.stringify(finalState, null, 2));
    
    // Print console logs
    console.log('\nConsole logs:');
    consoleLogs.forEach(log => console.log(`  ${log}`));
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'flutter-bootstrap.png'),
      fullPage: false 
    });
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-bootstrap.png'));
    console.log(`\nScreenshot: ${stat.size} bytes`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
