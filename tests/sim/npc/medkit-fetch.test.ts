import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { npcWorld, step, teleport } from './helpers';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });

for (const safe of [false, true]) test(`@E08 @E19 medkit stays at its world position at full health (warning-only corgi: ${safe})`, async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = safe;
  const id = w.pickups!.spawn('medkit', { x: 5, z: 0 }), kit = w.entities.get(id)!;
  const home = { ...kit.transform };
  step(w, 180);
  expect(kit.transform).toEqual(home);
  // Touch it, then depart through fetch range repeatedly: it must never follow the courier.
  for (const x of [5, 2, 5, 8, 5, 2]) { teleport(w, x, 0); step(w, 120); expect(kit.transform).toEqual(home); }
  expect(kit.pickup).toMatchObject({ collected: false });
  expect(w.events.events().filter(e => e.type === 'corgi.fetched' && e.pickupId === id)).toHaveLength(0);
  w.entities.get(1)!.health.current = 30; teleport(w, 5, 0); w.pickups!.update();
  expect(w.entities.get(1)!.health.current).toBe(80);
  expect(kit.pickup).toMatchObject({ collected: true });
  expect(w.events.events().filter(e => e.type === 'pickup.collected' && 'id' in e && e.id === id)).toHaveLength(1);
});

test('@E08 corgi cancels an in-flight medkit fetch when health becomes full', async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = false;
  const player = w.entities.get(1)!, corgi = [...w.entities.iterate()].find(e => e.companion)!;
  player.health.current = 30;
  const id = w.pickups!.spawn('medkit', { x: 5, z: 0 }), kit = w.entities.get(id)!, home = { ...kit.transform };
  step(w, 1); expect(corgi.companion!.pickup).toBe(id);
  player.health.current = player.health.max;
  step(w, 180);
  expect(corgi.companion!.pickup).toBeNull(); expect(kit.transform).toEqual(home);
});

test('@E19 warning-only corgi cancels restored fetch targets, including items', async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = true;
  const corgi = [...w.entities.iterate()].find(e => e.companion)!;
  const id = w.pickups!.spawn('item', { x: 5, z: 0 }, 'key'), kit = w.entities.get(id)!, home = { ...kit.transform };
  corgi.companion!.pickup = id; corgi.companion!.state = 'fetch';
  step(w, 180);
  expect(corgi.companion!.pickup).toBeNull(); expect(kit.transform).toEqual(home);
});

test('@E08 a fetch-enabled corgi still brings a medkit to an injured courier once', async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = false;
  w.entities.get(1)!.health.current = 30;
  const id = w.pickups!.spawn('medkit', { x: 5, z: 0 }); step(w, 180);
  expect(w.entities.get(1)!.health.current).toBeGreaterThanOrEqual(80);
  expect(w.entities.get(1)!.health.current).toBeLessThan(90);
  expect(w.entities.get(id)!.pickup).toMatchObject({ collected: true });
  expect(w.events.events().filter(e => e.type === 'corgi.fetched' && e.pickupId === id)).toHaveLength(1);
});
