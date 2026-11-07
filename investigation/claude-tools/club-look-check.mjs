// Photographs the club from Codex's five design views plus the third-person start, for checking finishes and light.
// Serve m5-prototype on 127.0.0.1:8796, then: node club-look-check.mjs <out-dir>
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js');
const { chromium } = require('playwright');
const out = process.argv[2] ?? '.';
const shots = [
  ['V01', [20, 1.65, 12], [22, 2.8, 27]], ['V02', [26, 1.65, 20], [10, 4.3, 22]],
  ['V03', [36, 1.65, 18], [41, 1.4, 24]], ['V04', [26, 5.15, 29], [24, 1, 19]],
  ['V05', [10, 1.65, 39.5], [8, 1.35, 33]], ['V06', [31.2, 1.65, 12.6], [38, 1.2, 9]],
  ['V07', [8, 5.15, 15], [20, 2, 26]], ['V08', [22, 1.65, 1], [22, 2.4, 6]], ['V09', [24, 1.65, 9], [14, 1.4, 9]], ['V10', [9, 1.65, 33], [5, 1.4, 30]], ['V11', [30, 6.5, 22], [12, 0, 22]],
];
const browser = await chromium.launch({ executablePath: 'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe', headless: true, args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 810 } });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8796/club-prototype.html');
  await page.waitForFunction(() => window.__cleanHands?.state().modelReady);
  await page.locator('#prep-go').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, 'club-start.png') });
  const p = ([x, y, z]) => ({ x, y, z });
  for (const [id, eye, target] of shots) {
    await page.evaluate(([e, t]) => { const a = window.__cleanHands; a.teleport(e.x, e.z, e.y - 1.65); a.inspectionCamera(e, t); }, [p(eye), p(target)]);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: path.join(out, `club-${id}.png`) });
  }
} finally { await browser.close(); console.log(JSON.stringify({ errors })); }
