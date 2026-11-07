// Shoot the five design views and compare the two standalone builds at the
// iPad landscape viewport, using the party benchmark's sampling procedure.
// Serve m5-prototype on 127.0.0.1:8797, then run this script with Node.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
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
  ['V01', [22, 1.65, 11.5], [23, 2.8, 27]],
  ['V02', [24, 1.65, 20], [12, 4.3, 25]],
  ['V03', [10, 1.65, 23.1], [8.6, 1.35, 29]],
  ['V04', [24, 5.15, 27], [23, 1, 19]],
  ['V05', [7.5, 1.65, 41], [7.2, 1.35, 36]],
];
const point = ([x, y, z]) => ({ x, y, z });
const output = name => fileURLToPath(new URL(name, import.meta.url));

try {
  for (const name of ['party-prototype.html', 'club-prototype.html']) {
    const page = await browser.newPage({
      viewport: { width: 1080, height: 810 },
      deviceScaleFactor: 2,
      hasTouch: true,
    });
    page.on('pageerror', error => errors.push({ name, error: error.message }));
    page.on('console', message => {
      if (message.type() === 'error') errors.push({ name, error: message.text() });
    });
    await page.bringToFront();
    await page.goto('http://127.0.0.1:8797/' + name);
    await page.waitForFunction(() => window.__cleanHands?.state().modelReady);
    await page.locator('#prep-go').click();
    await page.evaluate(() => window.__cleanHands.view(0, .3));
    const result = await page.evaluate(async () => {
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
      for (const [id, eye, target] of shots) {
        await page.evaluate(([eye, target]) => {
          const app = window.__cleanHands;
          app.teleport(eye.x, eye.z, eye.y - 1.65);
          app.inspectionCamera(eye, target);
        }, [point(eye), point(target)]);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await page.screenshot({ path: output(`club-stage1-${id}.png`), scale: 'css' });
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
  writeFileSync(output('club-stage1-performance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
