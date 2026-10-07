import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
async function mounted() {
  const l = await loadL1(1); world = l.world; const w = l.world, bike = w.vehicles!.bicycle.entity!;
  const at = { x: bike.transform.x, z: bike.transform.z };
  const player = w.entities.get(1)!; Object.assign(player.transform, { x: at.x, z: at.z }); w.physics.playerBody!.setTranslation(player.transform, true);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(true);
  return l;
}

test('E19 @E19 QA1-01 E at the parcel counter while riding picks up the parcel and keeps the courier on the bicycle', async () => {
  const { world: w, mission } = await mounted();
  const step = mission.def.steps.find(s => s.id === 'pickup')!, anchor = mission.def.anchors[(step.complete as { anchor: string }).anchor];
  const player = w.entities.get(1)!; Object.assign(player.transform, { x: anchor.x, z: anchor.z }); w.physics.playerBody!.setTranslation(player.transform, true); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(true);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(mission.state.steps.pickup.status).toBe('completed');
  expect(w.vehicles!.bicycle.riding).toBe(true);
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(true); // a late E right after the pickup still belongs to the counter
  for (let i = 0; i < 100; i++) w.update();
  w.setInput({ interact: true }); w.update(); w.clearInput(); w.update();
  expect(w.vehicles!.bicycle.riding).toBe(false); // nothing else claims the next press: dismount
});

test('E19 @E19 QA1-02 click-to-move on the bicycle follows the walking route to the parcel counter', async () => {
  const { world: w, mission } = await mounted();
  const step = mission.def.steps.find(s => s.id === 'pickup')!, anchor = mission.def.anchors[(step.complete as { anchor: string }).anchor];
  let ticks = 0; const p = () => w.entities.get(1)!.transform;
  w.setInput({ moveTarget: { x: anchor.x, z: anchor.z } }); w.update(); w.setInput({ moveTarget: undefined }); ticks++;
  while (Math.hypot(p().x - anchor.x, p().z - anchor.z) > 2.5 && ticks < 60 * 60) { w.update(); ticks++; }
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
