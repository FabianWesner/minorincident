import { launchBrowser } from '../browser-pool/client';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { l9Course } from '../../src/data/l9';

/** r33-l9polish: L9 ramp dressing and bay captures at night, one browser per call.
 *   E2E_PORT=4923 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/qa/r33-l9-ramps.ts <origin> <webgpu|webgl> <low|high> <outDir> [zooms=1,1.5]
 * Per ramp: the APC parked 16 m before it (static), then driven with W; a shot when the hull is airborne (y > 2.1) and one after the landing.
 * Bay: wall from the bay side and the far side, from the north end of the wall, and an APC parked at the north end (evacuation start probe). */
const [origin, renderer, quality, out, zoomArg] = process.argv.slice(2);
const zooms = (zoomArg ?? '1,1.5').split(',').map(Number);
mkdirSync(out, { recursive: true });
const browser = await launchBrowser({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', ...(renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [])] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
const where: Record<string, unknown> = {};
const shoot = async (name: string, only?: number[]) => {
  where[name] = await page.evaluate(() => { const s = window.__SS__!.getState(); const p = s.player!.transform; const game = (window.__SCENE__ as unknown as { game: Game }).game;
    const car = game.world.vehicles!.cars.get(game.world.missions!.l9!.state.carId)!;
    const rendered = game.view.labProbes().vehicles;
    return { x: +p.x.toFixed(1), y: +p.y.toFixed(2), z: +p.z.toFixed(1), physicsWheels: car.physics.wheels, rendered: rendered?.snapshot() }; });
  for (const zoom of only ?? zooms) {
    await page.evaluate(async zoom => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, view = game.view.view;
      view.follow(); view.zoom(Math.log(zoom / view.getState().targetZoom), true); for (let i = 0; i < 40; i++) game.view.advance(1 / 30);
      await window.__SS__!.step(1); window.__SS__!.vfx.stepRender(1 / 30); await window.__SS__!.screenshotReady();
    }, zoom);
    await page.screenshot({ path: `${out}/${name}-z${zoom}.png` });
    if (name === 'overpass-static' && zoom === 1) where.roofPicks = await page.evaluate(async () => {
      const modulePath = '/node_modules/three/build/three.webgpu.js';
      const { Raycaster, Vector2 } = await import(modulePath);
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const rows = [];
      for (let y = 175; y <= 225; y += 5) for (let x = 500; x <= 595; x += 5) {
        const ray = new Raycaster(); ray.setFromCamera(new Vector2(x / 640 - 1, 1 - y / 360), game.view.view.camera);
        const hit = ray.intersectObject(game.view.scene, true).find((h: { object: { visible: boolean } }) => h.object.visible);
        if (hit) { const names = []; for (let n = hit.object; n; n = n.parent) names.push(n.name || n.type); rows.push({ x, y, names, point: hit.point.toArray() }); }
      }
      return rows;
    });
  }
};
const place = async (x: number, z: number, yaw = 0) => {
  await page.evaluate(({ x, z, yaw }) => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    const car = w.vehicles!.cars.get(w.missions!.l9!.state.carId)!;
    car.physics.body.setTranslation({ x, y: 1, z }, true); car.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true);
    car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, { x, z, yaw });
  await page.evaluate(async () => { await window.__SS__!.step(45); window.__SS__!.vfx.stepRender(.5); });
};
try {
  await page.goto(`${origin}/?test=1&scenelab=1&renderer=${renderer}&quality=${quality}&audio=muted&dpr=1`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async q => { const a = window.__SS__!; await a.ready; a.pause(); a.settings.set({ quality: q }); await a.loadLevel('L9', { seed: 31 }); a.pause(); }, quality as 'low' | 'high');
  const begin = page.getByRole('button', { name: 'Begin mission' });
  if (await begin.isVisible().catch(() => false)) await begin.click();
  await page.evaluate(() => { window.__SS__!.pause(); document.body.classList.add('ui-hidden'); });
  await page.mouse.move(640, 300);
  for (const ramp of l9Course.ramps) {
    await place(ramp.x - 18, ramp.z);
    await shoot(`${ramp.id}-static`);
    await place(ramp.x - 40, ramp.z);
    await page.keyboard.down('KeyW');
    let air = false;
    for (let i = 0; i < 80 && !air; i++) {
      await page.evaluate(async () => { await window.__SS__!.step(6); window.__SS__!.vfx.stepRender(.1); });
      const s = await page.evaluate(() => { const p = window.__SS__!.getState().player!.transform; return { x: p.x, y: p.y }; });
      if (s.x > ramp.x + 1 && s.y > 2.1) { air = true; await shoot(`${ramp.id}-air`, [zooms[zooms.length - 1]]); }
    }
    for (let i = 0; i < 10; i++) await page.evaluate(async () => { await window.__SS__!.step(6); window.__SS__!.vfx.stepRender(.1); });
    await page.keyboard.up('KeyW');
    where[`${ramp.id}-airborne`] = air;
    await shoot(`${ramp.id}-landed`, [zooms[zooms.length - 1]]);
  }
  // Bay: gate wall and its extension. The APC is placed inside the bay, then at the north end of the wall.
  await place(452, 0); await shoot('bay-inside');
  await place(472 - 14, 30, Math.PI / 2 * .8); await shoot('bay-wall-north-end');
  await place(472 + 12, 30, Math.PI); await shoot('bay-beyond-north-end');
  const perf = await page.evaluate(() => window.__SS__!.perf());
  writeFileSync(`${out}/meta.json`, JSON.stringify({ origin, renderer, quality, backend: perf.backend, tier: perf.quality.tier, errors, where }, null, 2));
  console.log('captured', out, perf.backend, perf.quality.tier, errors.length, 'errors');
} finally { await browser.close(); }
