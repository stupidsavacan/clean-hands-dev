// Shoot four populated views and compare the two standalone builds at the
// iPad landscape viewport, using the party benchmark's sampling procedure.
// Serve m5-prototype on 127.0.0.1:8797, then run this script with Node and the saved stage-one HTML path.
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire('C:/Users/gamit/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/_entry.js');
const { chromium } = require('playwright');
const browser = await chromium.launch({
  executablePath: 'C:/Users/gamit/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',
  headless: true,
  args: ['--enable-gpu', '--use-gl=angle', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
const rows = [];
const errors = [];
const shots = [
  ['entrance', [20, 1.65, 12], [22, 2.3, 27]],
  ['bar', [36, 1.65, 17.3], [40, 1.5, 23]],
  ['lounge-vip', [24, 1.65, 21.8], [10, 2.7, 22]],
  ['kitchen', [11.7, 1.65, 34.7], [7.4, 1.4, 32]],
];
const stage1 = process.argv[2];
const checksOnly = stage1 === '--checks-only';
if (!stage1) throw Error('Pass the saved stage-one HTML as the first argument.');
const point = ([x, y, z]) => ({ x, y, z });
const output = name => fileURLToPath(new URL(name, import.meta.url));

try {
  for (const name of checksOnly ? ['club-prototype.html'] : ['party-prototype.html', 'club-stage1-reference.html', 'club-prototype.html']) {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 810 },
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    page.on('pageerror', error => errors.push({ name, error: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') errors.push({ name, error: message.text() });
    });
    if (name === 'club-stage1-reference.html') {
      await page.route('**/club-stage1-reference.html', route => route.fulfill({
        contentType: 'text/html; charset=utf-8', body: readFileSync(stage1),
      }));
    }
    await page.bringToFront();
    await page.goto('http://127.0.0.1:8797/' + name);
    await page.waitForFunction(() => window.__cleanHands?.state().modelReady);
    await page.locator('#prep-go').click();
    await page.evaluate(() => window.__cleanHands.view(0, .3));
    const result = checksOnly ? {npcs: await page.evaluate(() => window.__cleanHands.director().npcs.length)} : await page.evaluate(async () => {
      const app = window.__cleanHands;
      const frames = [], js = [], calls = [];
      let last = 0;
      await new Promise(resolve => {
        let index = 0;
        function sample(time) {
          if (index >= 120) {
            frames.push(time - last);
            const performance = app.performance();
            js.push(performance.jsFrameMs);
            calls.push(performance.drawCalls);
          }
          last = time;
          if (++index < 480) requestAnimationFrame(sample);
          else resolve();
        }
        requestAnimationFrame(sample);
      });
      const stat = values => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          mean: values.reduce((sum, value) => sum + value, 0) / values.length,
          p50: sorted[Math.floor(sorted.length * .5)],
          p95: sorted[Math.floor(sorted.length * .95)],
          max: sorted.at(-1),
        };
      };
      const canvas = document.querySelector('#view');
      const gl = canvas.getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        frames: stat(frames), jsFrameMs: stat(js), drawCalls: stat(calls),
        samples: frames.length, npcs: app.director().npcs.length,
        position: app.state().position, viewport: [innerWidth, innerHeight],
        renderBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        dpr: devicePixelRatio, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown',
        performance: app.performance(),
      };
    });
    rows.push({ name, ...result });
    if (name === 'club-prototype.html') {
      if (result.npcs !== 34 || !/クラブ/.test(await page.title())) throw Error('Unexpected club roster or title');
      const checks = await page.evaluate(() => {
        const a = window.__cleanHands;
        const walk = (x, z) => {
          for (let i = 0; i < 120; i++) {
            const p = a.state().position;
            if (Math.hypot(x-p.x,z-p.z)<.13) return;
            a.view(Math.atan2(x-p.x,z-p.z),.3);
            a.inspectionStep(['KeyW'],3);
          }
          throw Error('Could not walk to '+x+','+z+' from '+JSON.stringify(a.state().position));
        };
        walk(22,5.58);
        const before=a.inspectionStep(['KeyW'],60);
        if (before.z>6.01) throw Error('Entrance allowed uninspected entry');
        a.inspectionStep([],5);
        a.inspectionStep(['KeyB'],360);
        walk(22,8.8);
        walk(13,9.5);
        walk(11.2,9.5);
        walk(11.2,8.25);
        a.inspectionStep([],5);
        a.inspectionStep(['KeyT'],240);
        return { before, after:a.state().position };
      });
      await page.waitForFunction(() => document.querySelector('#m4-status').textContent.includes('バーテンダー'), undefined, { timeout: 5000 });
      checks.outfit=await page.locator('#m4-status').textContent();
      rows.at(-1).checks=checks;
      await page.waitForTimeout(2600);
      for (const [id, eye, target] of shots) {
        await page.evaluate(([eye, target]) => {
          const app = window.__cleanHands;
          app.teleport(eye.x, eye.z, eye.y - 1.65);
          app.inspectionCamera(eye, target);
        }, [point(eye), point(target)]);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: output(`club-stage2-${id}.png`), scale: 'css' });
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  const report = {
    method: '120 warm-up + 360 measured requestAnimationFrame intervals; native entrances; 1080×810 / DPR 2 / touch; Windows Chromium / ANGLE D3D11; no physical iPad',
    rows, errors, shots,
  };
  if (!checksOnly) writeFileSync(output('club-stage2-performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
