import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { Status } from '../../src/sim/combat/Status';

let world: SimWorld;
afterEach(() => world?.dispose());
for (const trigger of ['bullet', 'melee'] as const) test(`T-E27-10-${trigger} @E27 @E27-AC10 extinguisher extinguishes within 3 m and stuns its forward cone for exactly one second (${trigger})`, async () => {
  world = new SimWorld(); await world.init(); world.loadScenario('blast-lab');
  const h = world.hazards!, prop = h.spawn('extinguisher', { x: 8, z: 8 });
  const near = h.spawn('fire', { x: 10, z: 8 }), far = h.spawn('fire', { x: 12, z: 8 });
  const front = world.infected!.spawn('infected.runner', { x: 10, z: 8 });
  const back = world.infected!.spawn('infected.runner', { x: 6, z: 8 });
  h.hit(prop, 1, trigger);
  expect(world.entities.get(near)!.hazard!.activeUntil).toBe(world.tick);
  expect(world.entities.get(far)!.hazard!.activeUntil).toBeGreaterThan(world.tick);
  expect(Status.stunned(world.entities.get(front)!, world.tick)).toBe(true);
  expect(Status.stunned(world.entities.get(back)!, world.tick)).toBe(false);
  expect(world.entities.get(front)!.combat!.statuses[0].expires).toBe(world.tick + 60);
  h.hit(prop, 1, trigger);
  expect(world.events.events().filter(e => e.type === 'vfx.effect' && e.kind === 'smoke')).toHaveLength(1);
  for (let i = 0; i < 60; i++) world.update();
  expect(Status.stunned(world.entities.get(front)!, world.tick)).toBe(false);
});
