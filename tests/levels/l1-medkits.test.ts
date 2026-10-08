import { afterEach, expect, test } from 'vitest';
import { loadL1 } from '../../tools/sim-runner/l1Bots';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../src/sim/world/types';

/** PO 2026-10-07: "put 2-3 med packs at good places (not totally random), so the user can restore health." */
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
const medkits = (w: SimWorld) => [...w.entities.iterate()].filter((e): e is EntitySnapshot => !!e.pickup && 'kind' in e.pickup && e.pickup.kind === 'medkit');
const taken = (e: EntitySnapshot) => !!e.pickup && 'kind' in e.pickup && e.pickup.collected;

test('T-E19-medkits @E19 L1 has 2-3 reachable med packs along the post-accident route; each heals 50 % once and stays taken after a respawn', async () => {
  const { world: w, mission } = await loadL1(1); world = w;
  const kits = medkits(w), nav = w.infected!.nav, a = mission.def.anchors;
  expect(kits.length).toBeGreaterThanOrEqual(2); expect(kits.length).toBeLessThanOrEqual(3);
  const garage = nav.nearestCell(a['garage-door'].x, a['garage-door'].z), fire = nav.nearestCell(a['fire-bay-trigger'].x, a['fire-bay-trigger'].z);
  const direct = Math.hypot(a['garage-door'].x - a['fire-bay-trigger'].x, a['garage-door'].z - a['fire-bay-trigger'].z);
  for (const kit of kits) {
    const { x, z } = kit.transform, cell = nav.nearestCell(x, z), path: number[] = [];
    // On a walkable cell, reachable from the garage and onward to the station without a long detour.
    expect(Math.hypot(nav.x(cell) - x, nav.z(cell) - z), `${x},${z}`).toBeLessThan(.5);
    expect(nav.path(garage, cell, path, 200000)).toBe(true);
    const there = path.length * .5;
    expect(nav.path(cell, fire, path, 200000)).toBe(true);
    expect(there + path.length * .5, `${x},${z}`).toBeLessThanOrEqual(direct * 1.6 + 10);
  }
  // Spread along the route: one at the garage, the last before the final stretch.
  const along = kits.map(k => Math.hypot(k.transform.x - a['garage-door'].x, k.transform.z - a['garage-door'].z) / direct).sort((p, q) => p - q);
  expect(along[0]).toBeLessThan(.1); expect(along.at(-1)!).toBeGreaterThan(.6);
  // Pick-up: +50 % of max HP, one-shot; a full-HP courier leaves it for later.
  const player = w.entities.get(1)!, body = w.physics.playerBody!, kit = kits[1];
  const go = (at: { x: number; z: number }) => { Object.assign(player.transform, { x: at.x, z: at.z }); body.setTranslation(player.transform, true); };
  go(kit.transform); for (let i = 0; i < 5; i++) w.update();
  expect(taken(kit)).toBe(false);
  go({ x: kit.transform.x + 3, z: kit.transform.z }); for (let i = 0; i < 5; i++) w.update();
  w.player!.damage(70, w.tick); for (let i = 0; i < 40; i++) w.update();
  const before = player.health.current;
  go(kit.transform); for (let i = 0; i < 5; i++) w.update();
  expect(player.health.current - before).toBeGreaterThanOrEqual(49);
  expect(taken(kit)).toBe(true);
  expect(w.events.events().some(e => e.type === 'pickup.collected')).toBe(true);
  // Death and respawn keep the world: the taken kit stays taken, the others stay where they are.
  w.player!.damage(1000, w.tick); for (let i = 0; i < 400; i++) w.update();
  expect(player.health.current).toBe(player.health.max);
  const left = medkits(w).filter(e => !taken(e)).map(e => `${e.transform.x},${e.transform.z}`).sort();
  expect(left).toEqual(kits.filter(e => e !== kit).map(e => `${e.transform.x},${e.transform.z}`).sort());
}, 120_000);
