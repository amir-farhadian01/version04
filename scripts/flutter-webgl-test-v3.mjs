import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
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
  console.log(`\n=== Flutter WebGL Screenshot Test v3 ===`);
  console.log(`URL: ${URL}\n`);

  // Try with --use-gl=swiftshader (native SwiftShader, not ANGLE)
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      '--disable-gpu-sandbox',
      '--enable-gpu-rasterization',
      '--disable-software-rasterizer',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Listen for console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail') || text.toLowerCase().includes('webgl') || text.toLowerCase().includes('canvaskit') || text.toLowerCase().includes('context')) {
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
  await sleep(3000);

  // Check WebGL support
  const webglInfo = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return { supported: false };
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      supported: true,
      version: gl instanceof WebGL2RenderingContext ? 2 : 1,
      vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'unknown',
      renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
    };
  });
  console.log(`   WebGL: ${JSON.stringify(webglInfo)}`);

  // Wait for Flutter to render
  console.log('3. Waiting for Flutter render (60s timeout)...');
  let foundCanvas = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const domState = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const fltScene = document.querySelector('flt-scene');
      const fltView = document.querySelector('flt-view');
      return {
        hasCanvas: !!canvas,
        canvasSize: canvas ? `${canvas.width}x${canvas.height}` : null,
        hasFltScene: !!fltScene,
        hasFltView: !!fltView,
        bodyChildren: document.body ? document.body.children.length : 0,
      };
    });

    if (domState.hasCanvas) {
      console.log(`   Canvas rendered at ${i + 1}s! Size: ${domState.canvasSize}`);
      foundCanvas = true;
      break;
    }

    if (i % 10 === 9) {
      console.log(`   Still waiting... (${i + 1}s) canvas=${domState.hasCanvas}`);
    }
  }

  if (!foundCanvas) {
    console.log('   Flutter did not render canvas within 60s timeout');
  }

  // Take screenshot
  console.log('4. Taking screenshot...');
  const screenshotPath = join(SCREENSHOTS_DIR, 'flutter-webgl-test-v3.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const fs = await import('fs');
  const stats = fs.statSync(screenshotPath);
  console.log(`   Screenshot saved: ${screenshotPath} (${stats.size} bytes)`);

  // Print last 20 console logs
  console.log('\n5. Console logs:');
  consoleLogs.forEach(log => console.log(`   ${log}`));

  await browser.close();
  console.log('\n=== Test Complete ===');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
