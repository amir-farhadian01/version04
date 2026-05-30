/**
 * Check if Flutter is actually rendering
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
    console.log('🔍 Checking Flutter rendering...\n');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait a bit for Flutter to initialize
    await sleep(5000);
    
    // Check if _flutter is loaded and what state it's in
    const flutterState = await page.evaluate(() => {
      const state = {
        hasFlutter: typeof _flutter !== 'undefined',
        hasCanvasKit: typeof flutterCanvasKit !== 'undefined',
        hasCanvasKitLoaded: typeof flutterCanvasKitLoaded !== 'undefined',
        hasDartRunMain: typeof $dartRunMain !== 'undefined',
        hasDartMainTearOffs: typeof $dartMainTearOffs !== 'undefined',
        dartMainTearOffsCount: $dartMainTearOffs ? $dartMainTearOffs.length : 0,
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : 'NO_BODY',
        scriptSrc: '',
      };
      
      const script = document.querySelector('script[src]');
      if (script) state.scriptSrc = script.getAttribute('src') || '';
      
      return state;
    });
    
    console.log('Flutter state:');
    Object.entries(flutterState).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    
    // Wait longer and check again
    console.log('\nWaiting 15 more seconds...');
    await sleep(15000);
    
    const flutterState2 = await page.evaluate(() => {
      return {
        bodyChildren: document.body ? document.body.children.length : 0,
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 1000) : 'NO_BODY',
        hasCanvas: !!document.querySelector('canvas'),
        hasFltScene: !!document.querySelector('flt-scene-host'),
        hasFltView: !!document.querySelector('flutter-view'),
        hasFltSemantics: !!document.querySelector('flt-semantics'),
      };
    });
    
    console.log('\nAfter 15s wait:');
    Object.entries(flutterState2).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    
    // Take screenshot
    await page.screenshot({ 
      path: path.join(SCREENSHOT_DIR, 'flutter-after-wait.png'),
      fullPage: false 
    });
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-after-wait.png'));
    console.log(`\nScreenshot: ${stat.size} bytes`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
