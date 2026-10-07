// Gameplay render benchmark: N copies of a GLB under the game camera, WebGPU and WebGL2.
// Usage: node experiment/tools/bench_glb.mjs /experiment/<slug>/<variant>/model.glb [copies=25]
import { chromium } from 'playwright';
const [src, copies = '25'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-angle=metal', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const out = { src, copies: Number(copies) };
for (const mode of ['', 'webgl']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(`http://127.0.0.1:3300/preview/glb.html?review&bench=${copies}&src=${encodeURIComponent(src)}${mode ? '&' + mode : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__viewer?.ready || window.__viewer?.error, null, { timeout: 90000 });
  await page.evaluate(() => window.__viewer.measure(30));
  const r = await page.evaluate(() => window.__viewer.measure(240));
  out[mode ? 'webgl2' : 'webgpu'] = r;
  await page.close();
}
await browser.close();
console.log(JSON.stringify(out));
