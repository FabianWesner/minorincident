/** Q-166 PO views. Run under tools/e2e-lock.sh after a QA build. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { launchBrowser } from '../browser-pool/client';
import { preview } from 'vite';

const out = resolve(process.env.L4_CORPSE_OUT ?? 'test-results/l4-corpse-carpet/captures');
const port = Number(process.env.E2E_PORT ?? 4471);
if (port === 3300) throw new Error('Use the lane port');
mkdirSync(out, { recursive: true });
const server = await preview({ configFile: false, build: { outDir: resolve('dist') }, preview: { host: '127.0.0.1', port, strictPort: true } });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript('window.__name = value => value');
  await page.goto(`http://127.0.0.1:${port}/?test=1&crowdProbe=drawn&renderer=webgpu&quality=low&dpr=1&audio=muted&seed=3&preload=0`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready;
    await a.loadLevel('L4', { seed: 3, checkpoint: 'turn', progression: 'L4-default' });
    a.pause(); a.cheats.god(true); a.teleport('player', { x: -22.85, z: .7 }); a.camera.follow(); a.camera.zoom(1.5);
  });
  const samples = [];
  for (const seconds of [20, 60, 120, 150]) {
    await page.evaluate(async seconds => {
      const a = window.__SS__!, until = a.missions.state()!.l4!.turnAt + seconds * 60;
      while (a.tick() < until) await a.step(Math.min(60, until - a.tick()));
    }, seconds);
    for (const zoom of [1, 1.5]) {
      await page.evaluate(async zoom => { const a = window.__SS__!; a.camera.follow(); a.camera.zoom(zoom); await a.screenshotReady(); }, zoom);
      const sample = await page.evaluate(() => {
        const a = window.__SS__!, player = a.getState().player!.transform, all = a.query({});
        const live = all.filter(e => e.infected && e.health.current > 0 && !e.hidden && !e.infected.hidden);
        const drawn = new Set(a.crowdFigures().filter(f => f.drawn).map(f => f.id));
        const visible = live.filter(e => {
          const p = a.camera.project(e.transform.x, e.transform.y + .6, e.transform.z);
          return !e.pendingAdmission && Math.abs(p[0]) < .8 && Math.abs(p[1]) < .8 && p[2] > -1 && p[2] < 1;
        });
        return { layout: a.debug.corpseLayout(), backend: a.perf().backend, tier: a.perf().quality.tier, player, live: live.length, drawnLiving: visible.filter(e => drawn.has(e.id)).length,
          missingLiving: visible.filter(e => !drawn.has(e.id)).map(e => e.id), allDeadBodies14: all.filter(e => e.health.current <= 0 && (e.infected || e.civilian || e.corpse) && !e.hidden && Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 14).length, corpses14: all.filter(e => e.faction === 'infected' && e.health.current <= 0 && !e.hidden && Math.hypot(e.transform.x - player.x, e.transform.z - player.z) <= 14).length };
      });
      const file = `${seconds}s-z${zoom}.png`;
      await page.screenshot({ path: `${out}/${file}` });
      samples.push({ seconds, zoom, file, ...sample }); console.log(JSON.stringify(samples.at(-1)));
      if (sample.backend !== 'webgpu' || sample.tier !== 'low' || sample.missingLiving.length || sample.layout.sunkPairs || sample.layout.repeatedPairs || sample.layout.maxDisplacementM > 1.000001 || !sample.layout.courierClear) throw new Error('PO capture backend, quality, bounded heap settling, courier clearance or living figure proof failed');
    }
  }
  const receipt = { settings: { seed: 3, backend: 'webgpu', quality: 'low', viewport: [1280, 720], dpr: 1, zoom: [1, 1.5] }, bundles: await page.evaluate(() => [...document.scripts].map(s => s.src).filter(Boolean)), samples, errors };
  writeFileSync(`${out}/receipt.json`, JSON.stringify(receipt, null, 2));
  if (errors.length || samples.some(s => s.seconds === 150 && s.allDeadBodies14 > 150)) throw new Error('Q-166 capture count or browser errors failed');
} finally {
  await browser.close();
  await new Promise<void>((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
