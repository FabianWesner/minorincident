// Screenshot a GLB in the project's WebGPU viewer on both backends.
// Usage: node experiment/tools/capture_glb.mjs /experiment/<slug>/model.glb experiment/<slug>/renders/three [azimuthDeg...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
const [src, outPrefix, ...az] = process.argv.slice(2);
// views: numbers = study azimuths, 'game' = gameplay camera (az 45, FOV 25, high angle)
const views = az.length ? az : ['35', '215', 'game'];
mkdirSync(dirname(outPrefix), { recursive: true });
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist'] });
for (const mode of ['', 'webgl']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:3300/preview/glb.html?review&src=${encodeURIComponent(src)}${mode ? '&' + mode : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__viewer?.ready || window.__viewer?.error, null, { timeout: 60000 });
  const info = await page.evaluate(() => ({ backend: window.__viewer.backend, error: window.__viewer.error, stats: window.__viewer.stats }));
  for (const v of views) {
    await page.evaluate((x) => (x === 'game' ? window.__viewer.setView(45, 'game') : window.__viewer.setView(Number(x))), v);
    await page.waitForTimeout(700);
    await page.locator('canvas').screenshot({ path: `${outPrefix}-${info.backend}-${v === 'game' ? 'game' : 'az' + v}.png` });
  }
  console.log(JSON.stringify({ ...info, errors: errors.slice(0, 5) }));
  await page.close();
}
await browser.close();
