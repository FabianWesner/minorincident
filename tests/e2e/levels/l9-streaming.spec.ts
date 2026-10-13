import { mkdirSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';

const scene: SceneSpec = { name: 'l9-stream-revisit', ground: 'district', time: 'L9-crossing', dof: false,
  layout: { district: 'D-CROSSING', bbox: [[-600, -400], [600, 400]] },
  actors: [{ id: 'courier', kind: 'courier', at: [0, -325], state: 'idle' }, { id: 'corpse', kind: 'infected', at: [8, -325], state: { corpse: true } }],
  vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, -330], yaw: 0 }], camera: { mode: 'game', target: [0, -330], zoom: 1 } };

for (const tier of ['high', 'low'] as const) test(`T-E31-12-S3-browser @E31-AC12 @E31-AC13 ${tier} bounded load/revisit and quality switch`, async ({ page }) => {
  test.setTimeout(120_000);
  const requests: string[] = []; page.on('request', r => { if (r.url().includes('D-CROSSING')) requests.push(new URL(r.url()).pathname); });
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.step(2); await window.__SCENE__!.ready(); }, scene);
  const out = 'test-results/epics/E31/l9-stream'; mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/seam-before-${tier}.png` });
  const before = await page.evaluate(() => ({ vehicle: window.__SS__!.query({ kind: 'vehicle' })[0], corpses: window.__SS__!.query({ kind: 'infected' }).map(e => ({ id: e.id, health: e.health })) }));
  expect(before.corpses).toHaveLength(1); expect(before.corpses[0].health.current).toBe(0);
  for (const target of [[450, 0], [-450, 0], [0, 240], [0, -30], [0, -330]] as [number, number][]) {
    const p = await page.evaluate(async target => { window.__SCENE__!.setCamera({ mode: 'game', target }); await window.__SCENE__!.ready(); return window.__SS__!.perf(); }, target);
    expect(p.terrain!.resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9); expect(p.terrain!.queued).toBe(0); expect(p.terrain!.unloaded).toBeGreaterThan(0);
  }
  const after = await page.evaluate(() => ({ vehicle: window.__SS__!.query({ kind: 'vehicle' })[0], corpses: window.__SS__!.query({ kind: 'infected' }).map(e => ({ id: e.id, health: e.health })) }));
  expect(after.vehicle.id).toBe(before.vehicle.id); expect(after.vehicle.health).toEqual(before.vehicle.health); expect(after.corpses).toEqual(before.corpses);
  expect(requests.some(u => u.endsWith('D-CROSSING.base.glb'))).toBe(false);
  const repeated = requests.filter(u => u.endsWith('/crossing-6-0.glb')); expect(repeated.length).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `${out}/seam-after-${tier}.png` });
  await page.evaluate(async () => { window.__SS__!.debug.renderQuality('low'); await window.__SCENE__!.ready(); });
  expect(await page.evaluate(() => window.__SS__!.perf().terrain!.resident)).toBeLessThanOrEqual(9);
  await page.screenshot({ path: `${out}/revisit-${tier}.png` });
});

test('T-E31-12-delayed-S3-browser @E31-AC12 delayed terrain downloads keep sim/input progressing', async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, '/?test=1&scenelab=1&renderer=webgl&quality=low&audio=muted&dpr=1');
  await page.evaluate(async s => { await window.__SCENE__!.load(s); await window.__SCENE__!.ready(); }, scene);
  // Use the real door/input path; production asset URLs include a cache version.
  await page.evaluate(() => window.__SS__!.teleport(1, { x: .71, z: -327.975 }));
  await page.keyboard.down('KeyE'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('KeyE');
  expect(await page.evaluate(() => window.__SS__!.getState().player!.hidden)).toBe(true);
  await page.route('**/D-CROSSING.chunks/*.glb*', async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue(); });
  await page.keyboard.down('KeyW');
  const result = await page.evaluate(async () => {
    const api = window.__SS__!;
    window.__SCENE__!.setCamera({ mode: 'game', target: [450, 0] });
    const car = api.query({ kind: 'vehicle' })[0], before = api.tick(), position = car.transform;
    api.resume();
    await new Promise(r => setTimeout(r, 500)); api.pause(); api.input.clear();
    return { ticks: api.tick() - before, moved: api.getEntity(car.id)!.transform.x - position.x, terrain: api.perf().terrain };
  });
  await page.keyboard.up('KeyW');
  expect(result.ticks).toBeGreaterThan(5); expect(result.moved).toBeGreaterThan(.2); expect(result.terrain!.loading).toBeGreaterThan(0);
  await page.evaluate(async () => window.__SCENE__!.ready());
  expect(await page.evaluate(() => window.__SS__!.perf().terrain!.queued)).toBe(0);
});
