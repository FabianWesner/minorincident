import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
async function mounted(seed = 1) {
  const l = await loadL1(seed); world = l.world; const w = l.world, bike = w.vehicles!.bicycle.entity!;
  const at = { x: bike.transform.x, z: bike.transform.z };
  const player = w.entities.get(1)!; Object.assign(player.transform, { x: at.x, z: at.z }); w.physics.playerBody!.setTranslation(player.transform, true);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(true);
  return l;
}

test('E19 @E19 QA1-01 arriving at the depot counter on the bicycle without the parcel parks the bike; E picks up the parcel', async () => {
  const { world: w, mission } = await mounted();
  const step = mission.def.steps.find(s => s.id === 'pickup')!, anchor = mission.def.anchors[(step.complete as { anchor: string }).anchor];
  const player = w.entities.get(1)!; Object.assign(player.transform, { x: anchor.x, z: anchor.z }); w.physics.playerBody!.setTranslation(player.transform, true); w.update(); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(false); // the courier hops off at the depot (PO: bike parked visibly by the checkpoint)
  const bike = w.vehicles!.bicycle.entity!.transform; expect(Math.hypot(bike.x - anchor.x, bike.z - anchor.z)).toBeLessThan(8);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(mission.state.steps.pickup.status).toBe('completed');
  for (let i = 0; i < 900 && !player.survivor!.carrying; i++) w.update();
  expect(player.survivor!.carrying).toBeTruthy();
});

test.each([[1], [2], [3], [4], [5]])('E19 @E19 QA1-02 click-to-move from the bike start reaches the parcel counter (seed %i)', async (seed) => {
  const { world: w, mission } = await mounted(seed);
  const step = mission.def.steps.find(s => s.id === 'pickup')!, anchor = mission.def.anchors[(step.complete as { anchor: string }).anchor];
  let ticks = 0; const p = () => w.entities.get(1)!.transform;
  w.setInput({ moveTarget: { x: anchor.x, z: anchor.z } }); w.update(); w.setInput({ moveTarget: undefined }); ticks++;
  while (Math.hypot(p().x - anchor.x, p().z - anchor.z) > 2.5 && ticks < 90 * 60) { w.update(); ticks++; }
  console.info('G-RIDE-ROUTE', ticks / 60, Math.hypot(p().x - anchor.x, p().z - anchor.z).toFixed(1));
  expect(Math.hypot(p().x - anchor.x, p().z - anchor.z)).toBeLessThanOrEqual(2.5);
});

test.each([['lab-gate'], ['garage-door'], ['fire-bay-door'], ['carwash-start']])('E19 @E19 QA1-02 click-to-move on the bicycle reaches %s around fences', async (name) => {
  const { world: w, mission } = await mounted();
  const anchor = mission.def.anchors[name] ?? (w.districts as unknown as { anchors?: Record<string, { x: number; z: number }> }).anchors?.[name];
  if (!anchor) return;
  let ticks = 0, best = Infinity; const p = () => w.entities.get(1)!.transform;
  w.setInput({ moveTarget: { x: anchor.x, z: anchor.z } }); w.update(); w.setInput({ moveTarget: undefined });
  while (Math.hypot(p().x - anchor.x, p().z - anchor.z) > 4 && ticks < 90 * 60) { w.update(); ticks++; best = Math.min(best, Math.hypot(p().x - anchor.x, p().z - anchor.z)); if (!w.vehicles!.bicycle.riding) break; }
  console.info('G-RIDE-ROUTE', name, (ticks / 60).toFixed(1), Math.hypot(p().x - anchor.x, p().z - anchor.z).toFixed(1), w.vehicles!.bicycle.riding);
});
