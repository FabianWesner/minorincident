import { afterEach, expect, test } from 'vitest';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import { npcWorld, step, teleport } from './helpers';
let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); });
for (const options of [{ interactTicks: 36 }, { retain: true }, { interactTicks: 36, retain: true }]) test(`@E08 @E29 authored interaction pickup is never fetched: ${JSON.stringify(options)}`, async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = false;
  const id = w.combat!.pickups.spawn('weapon.rocket-launcher', { x: 5, z: 0 }, false, options);
  const home = { ...w.entities.get(id)!.transform }, dog = [...w.entities.iterate()].find(e => e.companion)!;
  // Also reject a fetch restored from an older checkpoint.
  dog.companion!.pickup = id; dog.companion!.state = 'fetch'; step(w, 180);
  expect(dog.companion!.pickup).toBeNull(); expect(w.entities.get(id)!.transform).toEqual(home);
});
for (const moveDog of [false, true]) test(`@E08 running fetch cancels outside player leash (dog departs: ${moveDog})`, async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = false;
  const id = w.combat!.pickups.spawn('weapon.bat', { x: 5, z: 0 }, true);
  step(w, 2); const dog = [...w.entities.iterate()].find(e => e.companion)!;
  expect(dog.companion!.pickup).toBe(id);
  if (moveDog) { dog.transform.x = -7; dog.transform.z = 0; }
  else teleport(w, -7, 0);
  step(w, 1); expect(dog.companion!.pickup).toBeNull(); expect(dog.companion!.state).toBe('follow');
});
test('@E08 ordinary dropped weapons remain fetchable', async () => {
  const w = world = await npcWorld(); w.npcs!.companion.forceSafe = false;
  const id = w.combat!.pickups.spawn('weapon.bat', { x: 5, z: 0 }, true);
  step(w, 180);
  expect(w.events.events().some(e => e.type === 'corgi.fetched' && e.pickupId === id)).toBe(true);
});
