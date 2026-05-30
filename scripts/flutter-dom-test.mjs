/**
 * Flutter DOM Inspection Script
 * Checks Flutter's shadow DOM and canvas rendering
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
    console.log('🔍 Flutter DOM Inspection\n');
    
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(8000);
    
    // Deep DOM inspection
    const domInfo = await page.evaluate(() => {
      const info = {
        bodyChildren: document.body ? document.body.children.length : 0,
        scripts: 0,
        styles: 0,
        divs: 0,
        canvases: 0,
        shadowRoots: [],
        allTags: {},
      };
      
      function walk(el, depth) {
        if (depth > 10) return;
        const tag = el.tagName ? el.tagName.toLowerCase() : '?';
        info.allTags[tag] = (info.allTags[tag] || 0) + 1;
        
        if (tag === 'script') info.scripts++;
        if (tag === 'style') info.styles++;
        if (tag === 'div') info.divs++;
        if (tag === 'canvas') info.canvases++;
        
        // Check for shadow root
        if (el.shadowRoot) {
          info.shadowRoots.push({
            tag,
            id: el.id || '',
            className: (el.className || '').substring(0, 50),
            shadowChildCount: el.shadowRoot.children.length,
            shadowHTML: el.shadowRoot.innerHTML.substring(0, 300)
          });
        }
        
        for (const child of el.children) {
          walk(child, depth + 1);
        }
      }
      
      if (document.body) walk(document.body, 0);
      return info;
    });
    
    console.log('Body children:', domInfo.bodyChildren);
    console.log('Scripts:', domInfo.scripts);
    console.log('Styles:', domInfo.styles);
    console.log('Divs:', domInfo.divs);
    console.log('Canvases:', domInfo.canvases);
    console.log('Shadow roots:', domInfo.shadowRoots.length);
    console.log('All tags:', JSON.stringify(domInfo.allTags));
    
    if (domInfo.shadowRoots.length > 0) {
      console.log('\nShadow DOM details:');
      domInfo.shadowRoots.forEach((s, i) => {
        console.log(`\n  Shadow root #${i}: <${s.tag}>#${s.id}.${s.className}`);
        console.log(`    Children: ${s.shadowChildCount}`);
        console.log(`    HTML: ${s.shadowHTML}`);
      });
    }
    
    // Check for Flutter-specific globals
    const flutterGlobals = await page.evaluate(() => {
      const globals = [];
      const keys = Object.keys(window);
      keys.filter(k => k.toLowerCase().includes('flutter') || k.toLowerCase().includes('dart')).forEach(k => {
        globals.push(k);
      });
      return globals;
    });
    console.log('\nFlutter/Dart globals:', flutterGlobals);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run();
