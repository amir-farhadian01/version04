/**
 * Flutter Accessibility Test
 * Uses page.accessibility.snapshot() to read Flutter widget tree
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
    console.log('📸 Testing Flutter accessibility...\n');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    
    // Try accessibility snapshot
    const accTree = await page.accessibility.snapshot();
    console.log('Accessibility tree available:', !!accTree);
    if (accTree) {
      console.log('Root node:', JSON.stringify(accTree).substring(0, 500));
    }
    
    // Try getting the page source
    const source = await page.content();
    console.log('\nPage source length:', source.length);
    console.log('Contains flt-scene:', source.includes('flt-scene'));
    console.log('Contains canvas:', source.includes('canvas'));
    console.log('Contains flutter-view:', source.includes('flutter-view'));
    
    // Check for specific Flutter initialization
    const hasFlutterInit = await page.evaluate(() => {
      return typeof window._flutter !== 'undefined' || 
             typeof window.flutterWebRenderer !== 'undefined' ||
             document.readyState === 'complete';
    });
    console.log('Flutter initialized:', hasFlutterInit);
    
    // Take screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'flutter-accessibility-test.png') });
    const stat = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-accessibility-test.png'));
    console.log(`Screenshot size: ${stat.size} bytes`);
    
    // Check if there's a canvas element in the shadow DOM
    const shadowInfo = await page.evaluate(() => {
      const info = [];
      // Check all elements for shadow roots
      document.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          info.push({
            tag: el.tagName,
            shadowChildren: el.shadowRoot.children.length,
            shadowHTML: el.shadowRoot.innerHTML.substring(0, 200)
          });
        }
      });
      return info;
    });
    console.log('\nShadow DOM elements:', shadowInfo.length);
    shadowInfo.forEach(s => console.log(`  <${s.tag}>: ${s.shadowChildren} children, HTML: ${s.shadowHTML}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
