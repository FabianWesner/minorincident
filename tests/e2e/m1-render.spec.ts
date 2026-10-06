import { mkdirSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { boot, expect, test } from './fixtures';
import { menuStart } from './ui-helpers';
import type { Page } from '@playwright/test';

const output = 'test-results/m1-render-fix';
async function shot(page: Page, name: string): Promise<PNG> {
  await page.evaluate(() => window.__SS__!.screenshotReady());
  mkdirSync(output, { recursive: true });
  return PNG.sync.read(await page.screenshot({ path: `${output}/${name}.png` }));
}
function hero(p: PNG, x: number, y: number): boolean {
  const i = (y * p.width + x) * 4;
  return p.data[i] > 240 && p.data[i + 1] < 20 && p.data[i + 2] > 240;
}
function difference(a: PNG, b: PNG, x: number, y: number): number {
  const i = (y * a.width + x) * 4;
  return Math.max(...[0, 1, 2].map(c => Math.abs(a.data[i + c] - b.data[i + c])));
}
function noise(p: PNG, mask: PNG): { pixels: number; spikes: number; ratio: number } {
  let pixels = 0, spikes = 0;
  for (let y = 2; y < p.height - 2; y++) for (let x = 2; x < p.width - 2; x++) {
    if (![[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]].every(([dx, dy]) => hero(mask, x + dx, y + dy))) continue;
    pixels++;
    const i = (y * p.width + x) * 4;
    // Include diagonals: thin diagonal eyes/straps are authored edges, not dots.
    if ([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].every(([dx, dy]) => {
      const j = ((y + dy) * p.width + x + dx) * 4;
      return Math.max(...[0, 1, 2].map(c => Math.abs(p.data[i + c] - p.data[j + c]))) > 30;
    })) spikes++;
  }
  return { pixels, spikes, ratio: spikes / pixels };
}

test('M1-27 @E19 real diner combat and wheel zoom keep survivor colour blocks free of speckle', async ({ page }) => {
  test.setTimeout(180_000); await menuStart(page);
  await page.evaluate(async () => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true); a.settings.set({ cameraShake: false, quality: 'high' });
    a.teleport('player', { x: 42, z: -6.5 }); await a.step(1);
    // Let nearer customers carry the chain before testing real diner combat.
    a.teleport('player', { x: 80, z: 0 });
  });
  // Setup shortcuts the walk; the authored diner outbreak and every attack are real.
  for (let i = 0; i < 130 && !await page.evaluate(() => window.__SS__!.missions.state()!.outbreak!.released); i++) {
    await page.evaluate(() => window.__SS__!.step(30));
  }
  await page.evaluate(async () => { const a = window.__SS__!; a.teleport('player', { x: 42, z: -6.5 }); await a.step(1); });
  await page.mouse.wheel(0, -500); await page.evaluate(() => window.__SS__!.step(30));
  for (let turn = 0; turn < 100; turn++) {
    const target = await page.evaluate(() => {
      const a = window.__SS__!, p = a.getState().player!.transform;
      return a.query({ kind: 'infected' }).filter(e => e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
    });
    if (!target) break;
    const point = await page.evaluate(p => window.__SS__!.input.project(p), target.transform);
    await page.mouse.move(point.x, point.y); await page.mouse.down({ button: 'left' });
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(36); a.vfx.stepRender(.6); }); await page.mouse.up({ button: 'left' });
  }
  await page.evaluate(async () => { const a = window.__SS__!; await a.step(90); a.vfx.stepRender(1); a.vfx.stepRender(.5); });
  const state = await page.evaluate(() => window.__SS__!.getState());
  expect(state.render.vfx!.kills).toBeGreaterThanOrEqual(4);
  expect(state.render.vfx!.decals).toBeGreaterThan(0);
  expect(state.render.character!.bloodCoverage).toBeGreaterThan(0);
  expect(state.render.camera.zoom).toBeLessThan(1);
  const combat = await shot(page, 'diner-combat');
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: true }));
  const mask = await shot(page, 'diner-mask');
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: false, gore: 'Off' }));
  const clean = await shot(page, 'diner-clean');
  const fullNoise = noise(combat, mask), cleanNoise = noise(clean, mask);
  let bloodPixels = 0;
  for (let y = 2; y < combat.height - 2; y++) for (let x = 2; x < combat.width - 2; x++) {
    if (hero(mask, x, y) && hero(mask, x - 2, y) && hero(mask, x + 2, y) && difference(combat, clean, x, y) > 30) bloodPixels++;
  }
  const evidence = { bloodPixels, fullNoise, cleanNoise, excess: fullNoise.ratio - cleanNoise.ratio, zoom: state.render.camera.zoom, coverage: state.render.character!.bloodCoverage, fx: state.render.vfx };
  writeFileSync(`${output}/diner-metrics.json`, JSON.stringify(evidence, null, 2));
  expect(fullNoise.pixels).toBeGreaterThan(1000);
  expect(bloodPixels, 'combat blood must remain visibly present as splats').toBeGreaterThan(50);
  expect(fullNoise.ratio, 'survivor surface must remain clean after combat').toBeLessThan(.015);
  expect(cleanNoise.ratio, 'gore-Off must also keep survivor surfaces clean').toBeLessThan(.015);
  expect(evidence.excess, 'blood must not introduce isolated contrasting pixels').toBeLessThan(.01);
});

test('M1-28 @E19 corpses behind and in front of the survivor preserve depth throughout fade', async ({ page }) => {
  test.setTimeout(120_000); await boot(page);
  const id = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true);
    a.settings.set({ cameraShake: false, gore: 'Reduced', bloom: false, quality: 'high' });
    a.setLoadout(['weapon.machete'], ['weapon.kick']);
    const id = a.spawn('infected.runner', { x: 1, z: 0 });
    for (let i = 0; i < 6 && a.getEntity(id)!.health.current > 0; i++) {
      const p = a.getState().player!.transform; a.teleport(id, { x: p.x + 1, z: p.z });
      const t = a.getEntity(id)!.transform;
      const length = Math.hypot(t.x - p.x, t.z - p.z) || 1;
      a.input.set({ aim: { x: (t.x - p.x) / length, z: (t.z - p.z) / length }, left: { down: true, held: true, up: false } });
      await a.step(1); a.input.clear(); await a.step(59);
    }
    await a.step(120); a.vfx.stepRender(1); a.vfx.stepRender(1);
    a.teleport('player', { x: 0, z: 0 }); a.teleport(id, { x: 20, z: 20 });
    a.camera.cinematic({ position: [5, 3, 5], target: [0, .65, 0] }); await a.step(60); await a.screenshotReady(); return id;
  });
  expect(await page.evaluate(id => window.__SS__!.getEntity(id)!.health.current, id)).toBe(0);
  const reference = await shot(page, 'depth-reference');
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: true }));
  const mask = await shot(page, 'depth-mask');
  await page.evaluate(() => window.__SS__!.settings.set({ idPass: false }));
  const samples = [];
  const solid = new Map<string, PNG>();
  for (const age of [180, 1800, 1860, 1919]) {
    await page.evaluate(async ({ id, age }) => { const a = window.__SS__!; a.teleport(id, { x: 20, z: 20 }); await a.step(Math.max(0, a.getEntity(id)!.infected!.deadAt + age - a.tick())); }, { id, age });
    const ageReference = await shot(page, `depth-reference-${age}`);
    for (const [side, offset] of [['behind', -.65], ['front', .65]] as const) {
      await page.evaluate(({ id, offset }) => window.__SS__!.teleport(id, { x: offset, z: offset }), { id, offset });
      const p = await shot(page, `depth-${side}-${age}-${samples.length}`);
      let changed = 0, upperChanged = 0, pixels = 0, overlap = 0, mixed = 0;
      if (age === 180) solid.set(side, p);
      const full = solid.get(side)!;
      const top = await page.evaluate(() => window.__SS__!.camera.project(0, .8, 0));
      const torsoY = (1 - top[1]) / 2 * p.height;
      for (let y = 2; y < p.height - 2; y++) for (let x = 2; x < p.width - 2; x++) {
        if (!hero(mask, x, y) || !hero(mask, x + 2, y) || !hero(mask, x - 2, y)) continue;
        pixels++;
        if (difference(reference, full, x, y) > 60) {
          overlap++;
          if (difference(ageReference, p, x, y) > 15 && difference(full, p, x, y) > 15) mixed++;
        }
        if (difference(ageReference, p, x, y) > 20) { changed++; if (y < torsoY) upperChanged++; }
      }
      samples.push({ age, side, changed, upperChanged, pixels, overlap, mixed, mixedRatio: mixed / Math.max(1, overlap) });
      writeFileSync(`${output}/depth-metrics.json`, JSON.stringify(samples, null, 2));
      expect(upperChanged / pixels, 'ground corpse cannot paint over the upper body').toBeLessThan(.005);
      if (age === 1860 && side === 'front') expect(mixed / Math.max(1, overlap), 'fade samples must preserve opaque depth, not blend a corpse through the survivor').toBeLessThan(.15);
    }
  }
  writeFileSync(`${output}/depth-metrics.json`, JSON.stringify(samples, null, 2));
  const front = samples.filter(s => s.side === 'front');
  expect(front[0].changed, 'a front corpse must occlude some of the feet').toBeGreaterThan(100);
  expect(front[2].changed, 'the fading corpse must still have visible depth').toBeGreaterThan(0);
  expect(front[3].changed, 'the fade must release the survivor silhouette').toBeLessThan(front[0].changed * .1);
});
