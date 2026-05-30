/**
 * Flutter Wait-for-Render Test
 * Waits for Flutter to actually render before taking screenshots
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const SCREENSHOT_DIR = path.resolve('screenshots');
const BASE_URL = 'http://localhost:7357';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForFlutterRender(page, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const rendered = await page.evaluate(() => {
      // Check if Flutter has rendered by looking for canvas or flt-scene elements
      const hasCanvas = !!document.querySelector('canvas');
      const hasFltScene = !!document.querySelector('flt-scene-host');
      const hasFltView = !!document.querySelector('flutter-view');
      
      // Check if body has more than just a script tag
      const bodyContent = document.body ? document.body.children.length : 0;
      const hasContent = bodyContent > 1;
      
      return {
        rendered: hasCanvas || hasFltScene || hasFltView || hasContent,
        canvas: hasCanvas,
        fltScene: hasFltScene,
        fltView: hasFltView,
        bodyChildren: bodyContent
      };
    });
    
    if (rendered.rendered) {
      console.log(`  Flutter rendered after ${Date.now() - start}ms`);
      console.log(`  Canvas: ${rendered.canvas}, flt-scene: ${rendered.fltScene}, flt-view: ${rendered.fltView}`);
      return rendered;
    }
    
    await sleep(500);
  }
  
  console.log(`  Timeout after ${timeout}ms - Flutter did not render`);
  return null;
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
    console.log('🔍 Flutter Wait-for-Render Test\n');
    
    // Load page
    console.log('1. Loading Flutter app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for Flutter to render
    const renderInfo = await waitForFlutterRender(page);
    
    if (renderInfo) {
      console.log('\n2. Flutter rendered successfully!');
      console.log(`   Body children: ${renderInfo.bodyChildren}`);
      
      // Take screenshot
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'flutter-rendered.png'),
        fullPage: false 
      });
      const stat = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-rendered.png'));
      console.log(`   Screenshot: ${stat.size} bytes`);
      
      // Now navigate to profile
      console.log('\n3. Navigating to profile...');
      await page.goto(`${BASE_URL}/#/profile`, { waitUntil: 'networkidle', timeout: 30000 });
      const profileRender = await waitForFlutterRender(page);
      
      if (profileRender) {
        await page.screenshot({ 
          path: path.join(SCREENSHOT_DIR, 'flutter-profile-rendered.png'),
          fullPage: false 
        });
        const stat2 = fs.statSync(path.join(SCREENSHOT_DIR, 'flutter-profile-rendered.png'));
        console.log(`   Profile screenshot: ${stat2.size} bytes`);
      }
    } else {
      console.log('\n❌ Flutter did not render within timeout');
      
      // Take screenshot anyway to see what's there
      await page.screenshot({ 
        path: path.join(SCREENSHOT_DIR, 'flutter-not-rendered.png'),
        fullPage: false 
      });
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
