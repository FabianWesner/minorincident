/** vqa60: L6 exit-stairs pin probe. Teleports the courier to the spot where the real-input run froze (249.4, 11.2),
 * then walks by input frames in 8 directions for 1.5 s each; logs travel per direction and courier state.
 *   E2E_UNITS=1 sh tools/e2e-lock.sh node --import tsx tools/qa/vqa60-l6-exit.ts [x] [z] */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preview } from 'vite';
import { launchBrowser } from '../browser-pool/client';

const [x = '249.4', z = '11.2'] = process.argv.slice(2);
const out = 'test-results/vqa60/l6exit'; mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 4370);
const server = await preview({ configFile: false, build: { outDir: resolve(process.env.VQA_DIST ?? 'dist') }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage(); page.setDefaultTimeout(240000); await page.addInitScript('globalThis.__name = fn => fn');
  await page.goto(`http://127.0.0.1:${port}/?test=1&scenelab=1&dpr=1&quality=low&audio=muted&preload=0&seed=1&renderer=webgl`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120000 });
  const res = await page.evaluate(async ({ x, z }) => {
    const a = window.__SS__!; await a.ready; a.pause();
    await a.loadLevel('L6', { seed: 1, progression: 'L6-default' } as never); a.missions.begin(); a.pause(); a.camera.follow(); a.cheats.god(true); await a.step(30);
    a.teleport(1, { x, z }); await a.step(60);
    const me = () => { const t = a.getEntity(1)!.transform as { x: number; y: number; z: number }; return { x: +t.x.toFixed(3), y: +t.y.toFixed(3), z: +t.z.toFixed(3) }; };
    const rows: unknown[] = [{ at: me() }];
    for (let k = 0; k < 8; k++) {
      const ang = k / 8 * Math.PI * 2, move = { x: Math.cos(ang), z: Math.sin(ang) };
      a.teleport(1, { x, z }); await a.step(10); const s = me();
      for (let t = 0; t < 90; t++) { a.input.set({ move } as never); await a.step(1); }
      a.input.clear(); const e = me(); rows.push({ move: [+move.x.toFixed(2), +move.z.toFixed(2)], from: s, to: e, travel: +Math.hypot(e.x - s.x, e.z - s.z).toFixed(2) });
    }
    return rows;
  }, { x: Number(x), z: Number(z) });
  await page.evaluate(async () => { const a = window.__SS__!; a.camera.zoom(1.5); await a.step(5); await a.screenshotReady(); });
  await page.screenshot({ path: `${out}/exit-${x}-${z}.jpg`, type: 'jpeg', quality: 85 });
  writeFileSync(`${out}/probe-${x}-${z}.json`, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
  await context.close();
} finally { await browser.close(); await server.close(); }
process.exit(0);
