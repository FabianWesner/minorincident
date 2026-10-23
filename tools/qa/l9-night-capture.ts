import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';

/** l9-night-look: real-game L9 captures along the drive (start, mid-route, crash, arrival) x zooms, one browser per call.
 * The healthy APC is moved onto each station and driven ~2 s with W, so headlights, dust and residency are live.
 *   E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/l9-night-capture.ts <origin> <webgpu|webgl> <low|high> <outDir> [zooms=0.5,1,1.5]
 * Origin: https://minor-incident.com (PROD) or a local preview (never port 3300). Writes <out>/<station>-z<zoom>.png. */
const [origin, renderer, quality, out, zoomArg] = process.argv.slice(2);
const zooms = (zoomArg ?? '0.5,1,1.5').split(',').map(Number);
/** Optional: LOOK='{"sunIntensity":.5}' live look patch (lookdev only), STATIONS='1,4' subset. */
const look = process.env.LOOK ? JSON.parse(process.env.LOOK) : null;
const only = process.env.STATIONS?.split(',');
const want = (n: string) => !only || only.includes(n[0]);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', ...(renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const where: Record<string, unknown> = {};
const shoot = async (name: string) => {
  if (!want(name)) return;
  where[name] = await page.evaluate(() => { const s = window.__SS__!.getState(); const p = s.player!.transform; return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), render: s.render.camera }; });
  for (const zoom of zooms) {
    await page.evaluate(async zoom => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view.view;
      view.follow(); view.zoom(Math.log(zoom / view.getState().targetZoom), true); for (let i = 0; i < 40; i++) game.view.advance(1 / 30);   // the driver camera eases out over ~0.7 s
      if ((window as unknown as { __NOSHADOW__?: boolean }).__NOSHADOW__) game.view.scene.traverse(o => { if ((o as { isLight?: boolean }).isLight) (o as { castShadow: boolean }).castShadow = false; });
      for (const hide of (window as unknown as { __HIDE__?: string[] }).__HIDE__ ?? []) game.view.scene.traverse((o: any) => { if (o.name === hide || o.material?.name === hide) o.visible = false; });
      await window.__SS__!.step(2); window.__SS__!.vfx.stepRender(1 / 30); await window.__SS__!.screenshotReady();
    }, zoom);
    await page.screenshot({ path: `${out}/${name}-z${zoom}.png` });
    if (process.env.PROBE) console.log(name, zoom, JSON.stringify(await page.evaluate(async px => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, cam = game.view.view.camera, out: unknown[] = [];
      cam.updateMatrixWorld(); const THREE = cam.position.constructor as unknown as new () => { set(...a: number[]): any };
      for (const [sx, sy] of px) {
        const v = new THREE(); (v as any).set(sx / 1280 * 2 - 1, -(sy / 720) * 2 + 1, .5); (v as any).unproject(cam);
        const d = (v as any).sub(cam.position).normalize(), t = -cam.position.y / d.y; out.push([+(cam.position.x + d.x * t).toFixed(1), +(cam.position.z + d.z * t).toFixed(1)]);
      }
      return out;
    }, JSON.parse(process.env.PROBE))));
  }
};
const drive = async (x: number, z: number, ticks: number) => {
  await page.evaluate(({ x, z }) => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    const car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
    car.physics.body.setTranslation({ x, y: 1, z }, true);
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, { x, z });
  await page.keyboard.down('KeyW');
  // Render time follows the sim (30 ticks = .5 s): Blasts refreshes the persistent fires at 4 Hz of render time, flames and
  // light-field flicker run on it too. Without it the drive captures show no ambient fire at all.
  for (let t = 0; t < ticks; t += 30) await page.evaluate(async () => { await window.__SS__!.step(30); window.__SS__!.vfx.stepRender(.5); });
  await page.keyboard.up('KeyW');
};
try {
  await page.goto(`${origin}/?test=1&scenelab=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async q => { const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: q }); await a.loadLevel('L9', { seed: 31 }); a.pause(); }, quality as 'low' | 'high');
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  await page.evaluate(look => { window.__SS__!.pause(); document.body.classList.add('ui-hidden'); if (look) window.__SS__!.look.set({ version: 1, worldLook: look, palette: {} }); }, look);
  if (process.env.HIDE) await page.evaluate(h => { (window as unknown as { __HIDE__: string[] }).__HIDE__ = h; }, process.env.HIDE.split(','));
  if (process.env.NOSHADOW) await page.evaluate(() => { (window as unknown as { __NOSHADOW__: boolean }).__NOSHADOW__ = true; });
  await page.mouse.move(640, 300);
  await drive(-540, 0, 150); await shoot('1-start');
  await drive(-60, -330, 150); await shoot('2-mid-road');
  await drive(-60, -30, 150); await shoot('3-mid-dry');
  await drive(415, 0, 90); await shoot('4-approach');
  await drive(455, 0, 0);
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 12 && await page.evaluate(() => window.__SS__!.getState().l9!.phase === 'driving'); i++) await page.evaluate(() => window.__SS__!.step(60));
  await page.keyboard.up('KeyW');
  await page.evaluate(async () => { await window.__SS__!.step(551); window.__SS__!.vfx.stepRender(1); });
  await shoot('5-crash');
  await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 20 && a.getState().l9!.phase !== 'done'; i++) { await a.step(60); a.vfx.stepRender(1); } a.teleport(1, { x: 540, z: 2 }); await a.step(30); });
  await shoot('6-arrival');
  const perf = await page.evaluate(() => window.__SS__!.perf());
  writeFileSync(`${out}/meta.json`, JSON.stringify({ origin, renderer, quality, backend: perf.backend, tier: perf.quality.tier, errors, where }, null, 2));
  console.log('captured', out, perf.backend, perf.quality.tier, errors.length, 'errors');
} finally { await browser.close(); }
