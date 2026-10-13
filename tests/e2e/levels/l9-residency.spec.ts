import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import type { SceneSpec } from '../../../src/debug/scenelab/spec';
const scene: SceneSpec = {
  name: 'l9-residency-revisit', ground: 'district', time: 'L9-crossing', dof: false,
  layout: { district: 'D-CROSSING', bbox: [[-600, -400], [600, 400]] },
  actors: [{ id: 'courier', kind: 'courier', at: [0, -320], state: 'idle' }, { id: 'corpse', kind: 'infected', at: [8, -325], state: { corpse: true } }],
  vehicles: [{ id: 'apc', asset: 'vehicle.military-apc', at: [0, -330], yaw: 0, health: 350 }],
  camera: { mode: 'game', target: [0, -326], zoom: 1 },
};
for (const tier of ['high', 'low'] as const) for (const zoom of [1, .5]) test(`T-E31-13-S4-browser @E31-AC12 @E31-AC13 ${tier} zoom ${zoom} unload/revisit keeps identities and support`, async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&quality=${tier}&audio=muted&dpr=1`);
  await page.evaluate(async ({ scene, zoom }) => { await window.__SCENE__!.load(scene); window.__SCENE__!.setCamera({ mode: 'game', target: [0, -326], zoom }); await window.__SCENE__!.step(2); await window.__SCENE__!.ready(); }, { scene, zoom });
  const before = await page.evaluate(() => ({ corpse: window.__SS__!.query({ kind: 'infected' })[0], vehicle: window.__SS__!.query({ kind: 'vehicle' })[0], chunks: window.__SS__!.getState().chunkResidency! }));
  expect(before.corpse.corpse).toBe(true);
  const out = `test-results/epics/E31/residency-browser/${tier}-z${zoom}`; mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/before.png` });
  // This moves the simulation's focus, exercising entity/collider ownership (camera-only travel covers S3).
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => { window.__SS__!.teleport(1, { x: 450, z: 220 }); window.__SS__!.step(2); });
    expect(await page.evaluate(id => window.__SS__!.getEntity(id), before.corpse.id)).toBeNull();
    const away = await page.evaluate(() => window.__SS__!.getState().chunkResidency!);
    expect(away.resident).toBeLessThanOrEqual(tier === 'high' ? 25 : 9); expect(away.inactive).toBeGreaterThan(0);
    await page.evaluate(() => { window.__SS__!.teleport(1, { x: 0, z: -320 }); window.__SS__!.step(2); });
    const restored = await page.evaluate(id => window.__SS__!.getEntity(id), before.corpse.id);
    expect(restored!.corpse).toBe(true); expect(restored!.health).toEqual(before.corpse.health);
  }
  await page.evaluate(async () => window.__SCENE__!.ready());
  const after = await page.evaluate(() => ({ corpse: window.__SS__!.query({ kind: 'infected' })[0], vehicle: window.__SS__!.query({ kind: 'vehicle' })[0], chunks: window.__SS__!.getState().chunkResidency! }));
  expect(after.vehicle.id).toBe(before.vehicle.id); expect(after.vehicle.health).toEqual(before.vehicle.health); expect(after.vehicle.transform.y).toBeGreaterThan(0);
  expect(after.corpse.id).toBe(before.corpse.id); expect(after.chunks.resident).toBe(before.chunks.resident); expect(after.chunks.navCells).toBe(before.chunks.navCells);
  await page.screenshot({ path: `${out}/after.png` }); writeFileSync(`${out}/state.json`, JSON.stringify({ before, after }, null, 2));
});
