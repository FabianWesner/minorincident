// Draw calls, triangles and frame time at L1 spots (start area, Juniper loop, lab gate) with the play
// camera at default and maximum zoom. Usage: LOAD_SPKI=... tsx tools/performance/lod-probe.ts <baseUrl>
import { chromium } from '@playwright/test';
import { launchArgs } from './load-measure';
const [base = 'https://127.0.0.1:3362/'] = process.argv.slice(2);
const spki = process.env.LOAD_SPKI ? [`--ignore-certificate-errors-spki-list=${process.env.LOAD_SPKI}`] : [];
const browser = await chromium.launch({ headless: true, args: [...launchArgs, ...spki] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, ignoreHTTPSErrors: !process.env.LOAD_SPKI });
await page.goto(`${base}?test=1&audio=muted&quality=high&dpr=1`);
await page.waitForFunction(() => Boolean((window as unknown as { __SS__?: unknown }).__SS__), undefined, { timeout: 120_000 });
type Api = { ready: Promise<void>; loadLevel(id: string): Promise<void>; screenshotReady(): Promise<void>; teleport(id: 'player', p: { x: number; z: number }): void; pause(): void; resume(): void; step(n: number): Promise<void>; perf(): { drawCalls: number; triangles: number; frameMs: number } };
const loadMs = await page.evaluate(async () => { const a = (window as unknown as { __SS__: Api }).__SS__; await a.ready; const t = performance.now(); await a.loadLevel('L1'); await a.screenshotReady(); return performance.now() - t; });
page.on('crash', () => console.log('page crashed')); page.on('close', () => console.log('page closed')); browser.on('disconnected', () => console.log('browser disconnected'));
console.log(`L1 load (test API, incl. ready) ${Math.round(loadMs)} ms`);
try { for (const [name, x, z] of [['start', -66.4, 9], ['juniper-loop', -5, 0], ['lab-gate', 62, -8]] as const) for (const zoom of [0]) {
  await page.evaluate(({ x, z }) => { const a = (window as unknown as { __SS__: Api }).__SS__; a.pause(); a.teleport('player', { x, z }); a.resume(); }, { x, z });
  await page.mouse.move(800, 450);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, zoom ? 600 : -600);
  await page.waitForTimeout(2500);
  // Plain JS source: tsx/esbuild would inject __name helpers into a serialized TS function.
  const out = await page.evaluate(`new Promise(resolve => {
    const a = window.__SS__, frames = [], draws = [], tris = []; let last = performance.now();
    const tick = () => {
      const now = performance.now(); frames.push(now - last); last = now; const p = a.perf(); draws.push(p.drawCalls); tris.push(p.triangles);
      if (frames.length < 120) { requestAnimationFrame(tick); return; }
      const avg = v => v.reduce((s, n) => s + n, 0) / v.length, sorted = frames.slice(5).sort((p, q) => p - q);
      resolve({ frameAvg: avg(frames.slice(5)), frameP95: sorted[Math.floor(sorted.length * .95)], frameMax: sorted[sorted.length - 1], draws: Math.round(avg(draws)), triangles: Math.round(avg(tris)) });
    };
    requestAnimationFrame(tick);
  })`) as { frameAvg: number; frameP95: number; frameMax: number; draws: number; triangles: number };
  console.log(`${name.padEnd(13)} zoom ${zoom ? 'max' : 'default'}  draws ${out.draws}  tris ${(out.triangles / 1e6).toFixed(2)}M  frame avg ${out.frameAvg.toFixed(1)} p95 ${out.frameP95.toFixed(1)} max ${out.frameMax.toFixed(1)} ms`);
}
} catch (error) { console.error('probe failed', error); }
await browser.close();
