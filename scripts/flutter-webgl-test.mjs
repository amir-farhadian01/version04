import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = join(__dirname, '..', 'screenshots');
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const URL = process.argv[2] || 'http://localhost:7359';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log(`\n=== Flutter WebGL Screenshot Test ===`);
  console.log(`URL: ${URL}`);
  console.log(`Screenshots dir: ${SCREENSHOTS_DIR}\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--disable-software-rasterizer',
      '--enable-features=Vulkan',
      '--disable-gpu-sandbox',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Listen for console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('error') || text.includes('Error') || text.includes('FAILED') || text.includes('failed')) {
      console.log(`  [CONSOLE] ${msg.type()}: ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`  [PAGE ERROR] ${err.message}`);
  });

  console.log('1. Navigating to Flutter app...');
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  console.log('   Page loaded');

  // Wait for Flutter to initialize
  console.log('2. Waiting for Flutter initialization...');
  await sleep(5000);

  // Check Flutter state
  const flutterState = await page.evaluate(() => {
    return {
      hasFlutter: typeof window._flutter !== 'undefined',
      hasLoader: !!(window._flutter && window._flutter.loader),
      hasBuildConfig: !!(window._flutter && window._flutter.buildConfig),
      bodyChildren: document.body ? document.body.children.length : 0,
      bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : 'no body',
    };
  });
  console.log(`   Flutter state: ${JSON.stringify(flutterState, null, 2)}`);

  // Wait for Flutter to render
  console.log('3. Waiting for Flutter render (30s timeout)...');
  let foundCanvas = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);
    const domState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const fltScene = document.querySelector('flt-scene');
      const fltView = document.querySelector('flt-view');
      const allElements = document.querySelectorAll('*');
      const elementTypes = new Set();
      allElements.forEach(el => elementTypes.add(el.tagName.toLowerCase()));
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
        hasFltScene: !!fltScene,
        hasFltView: !!fltView,
        bodyChildren: document.body ? document.body.children.length : 0,
        elementTypes: Array.from(elementTypes).slice(0, 30),
        bodyHTML: document.body ? document.body.innerHTML.substring(0, 300) : 'no body',
      };
    });

    if (domState.hasCanvas || domState.hasFltScene || domState.hasFltView) {
      console.log(`   Flutter rendered at ${i + 1}s!`);
      console.log(`   DOM state: ${JSON.stringify(domState, null, 2)}`);
      foundCanvas = true;
      break;
    }

    if (i % 5 === 4) {
      console.log(`   Still waiting... (${i + 1}s) DOM: ${JSON.stringify(domState)}`);
    }
  }

  if (!foundCanvas) {
    console.log('   Flutter did not render within 30s timeout');
  }

  // Take screenshot
  console.log('4. Taking screenshot...');
  const screenshotPath = join(SCREENSHOTS_DIR, 'flutter-webgl-test.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const fs = await import('fs');
  const stats = fs.statSync(screenshotPath);
  console.log(`   Screenshot saved: ${screenshotPath} (${stats.size} bytes)`);

  // Check WebGL support
  const webglInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false, error: 'No WebGL context' };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      supported: true,
      version: gl instanceof WebGL2RenderingContext ? 2 : 1,
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
    };
  });
  console.log(`   WebGL info: ${JSON.stringify(webglInfo, null, 2)}`);

  await browser.close();
  console.log('\n=== Test Complete ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
