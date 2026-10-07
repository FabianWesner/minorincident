import { readFileSync } from 'node:fs';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { expect, test } from 'vitest';
import { bicycleGeometry as g } from '../../src/data/bicycleGeometry';
import { compositions } from '../../src/levels/compositions';
import { inside } from '../../src/levels/districts/validate';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { loadL1 } from '../../tools/sim-runner/l1Bots';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-GROVE.layout.json', 'utf8')) as DistrictLayout;
function step(w: SimWorld, ticks: number) { for (let i = 0; i < ticks; i++) w.update(); }
function teleport(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y: w.districts!.pavingHeight(x, z) + .72 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z);
}
function assertPavement(w: SimWorld) {
  const bike = w.vehicles!.bicycle.entity!, t = bike.transform, heading = -t.yaw, fx = Math.cos(heading), fz = Math.sin(heading), offset = bike.bicycle!.mounted ? g.mountOffset : 0;
  const contacts = [g.rearWheel, g.frontWheel].flatMap(along => [-.1, .1].flatMap(a => [-.1, .1].map(side => [t.x + fx * (along + offset + a) - fz * side, t.z + fz * (along + offset + a) + fx * side] as [number, number])));
  expect(layout.surfaces.some(s => s.surface === 'tile' && contacts.every(p => inside(p, s.polygon))), JSON.stringify(t)).toBe(true);
  for (const p of contacts) expect(w.districts!.pavingHeight(...p)).toBeCloseTo(t.y, 3);
  const centre = (g.minX + g.maxX) / 2 + offset;
  const hit = w.physics.world!.intersectionWithShape({ x: t.x + fx * centre, y: t.y + .01 + g.height / 2, z: t.z + fz * centre }, { x: 0, y: Math.sin(t.yaw / 2), z: 0, w: Math.cos(t.yaw / 2) }, new RAPIER.Cuboid((g.maxX - g.minX) / 2, g.height / 2, g.halfWidth), RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC, undefined, w.physics.playerCollider!);
  expect(hit?.handle).toBeUndefined();
}

test('parked start, mount at rack, depot and automatic road parking keep both wheels on pavement @E19', async () => {
  const w = new SimWorld(); await w.init(); w.loadComposition(compositions['D-GROVE'], [layout], 1);
  try {
    const b = w.vehicles!.bicycle; assertPavement(w);
    const start = { ...b.entity!.transform }; expect(Math.hypot(start.x + 66.4, start.z - 9)).toBeLessThan(3.3);
    teleport(w, start.x + .9, start.z); w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false });
    expect(b.riding).toBe(true); assertPavement(w);
    // The existing depot arrival path owns the automatic dismount.
    teleport(w, -37.8, -37.6); step(w, 2); expect(b.riding).toBe(false); assertPavement(w);
    // Move away and return; a parked bike is available to ACTION too.
    const depot = { ...b.entity!.transform }; teleport(w, depot.x + .9, depot.z); step(w, 30);
    w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false }); expect(b.riding).toBe(true); assertPavement(w);
    // Interact on the carriageway automatically finds a safe nearby sidewalk.
    teleport(w, -40, 0); step(w, 100); w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false });
    expect(b.riding).toBe(false); assertPavement(w);
  } finally { w.dispose(); }
});

test('garage bat pickup permits walking back to the parked bike, ACTION remount and riding 30 m @E19', async () => {
  const { world: w, mission } = await loadL1(1);
  try {
    w.combat!.damage.god = true;
    for (const id of ['pickup', 'deliver', 'escape']) mission.completeObjective(id);
    // Arrive by bike at the garage; the no-bike zone parks it on the public sidewalk.
    const b = w.vehicles!.bicycle, p = w.entities.get(1)!;
    b.entity!.bicycle!.mounted = true; b.entity!.bicycle!.heading = Math.PI / 2; p.riding = b.entity!.id;
    teleport(w, 22.8, 34); step(w, 1); teleport(w, 22.8, 35.3); step(w, 2); expect(b.riding).toBe(false); assertPavement(w);
    const bat = mission.def.anchors['garage-bat']; teleport(w, bat.x, bat.z);
    w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false }); step(w, 360);
    expect(mission.state.steps.weapon.status).toBe('completed'); expect(w.storyLock).toBeNull();
    expect(p.weapons!.LEFT.rack.some(a => a.id === 'weapon.bat')).toBe(true);
    // Isolate remount eligibility from the intentional infected-contact dismount rule.
    for (const e of [...w.infected!.active]) w.infected!.release(e);
    w.infected!.director.levelCap = 0;
    const parked = { ...b.entity!.transform };
    w.setInput({ moveTarget: { x: parked.x, z: parked.z } }); step(w, 1); w.setInput({ moveTarget: undefined });
    for (let i = 0; i < 600 && Math.hypot(p.transform.x - parked.x, p.transform.z - parked.z) > 1.5; i++) step(w, 1);
    expect(w.vehicles!.canInteract()).toBe(true);
    w.setInput({ interact: true }); step(w, 1); w.setInput({ interact: false }); expect(b.riding).toBe(true); assertPavement(w);
    const start = { ...p.transform }; const goal = { x: start.x - 30, z: start.z };
    w.setInput({ moveTarget: goal }); step(w, 1); w.setInput({ moveTarget: undefined });
    for (let i = 0; i < 1200 && Math.hypot(p.transform.x - goal.x, p.transform.z - goal.z) > .15; i++) step(w, 1);
    expect(b.riding).toBe(true); expect(Math.hypot(p.transform.x - start.x, p.transform.z - start.z)).toBeGreaterThan(29.8);
  } finally { w.dispose(); }
});
