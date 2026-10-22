import { expect, test, vi } from 'vitest';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { GameEvent } from '../../../src/sim/world/types';

test('T-E22-20-event-copy @E22-AC20 combat bursts use the existing plain-data copier while preserving independent event payloads', () => {
  const world = new SimWorld();
  const event: GameEvent = { type: 'combat.attack', tick: 1, attackId: 1, actionId: 'pistol', sourceId: 1, side: 'LEFT', position: { x: 1, y: .7, z: 2, yaw: 0 }, direction: { x: 1, z: 0 } };
  const expected = structuredClone(event), clone = vi.spyOn(globalThis, 'structuredClone');
  try {
    world.events.on('combat.attack', value => { if (value.type === 'combat.attack') value.position.x = 99; });
    world.events.emit(event);
    expect(clone, 'plain combat events need no native serialization round trip').not.toHaveBeenCalled();
  } finally { clone.mockRestore(); }
  expect(world.events.events()).toEqual([expected]);
  event.direction.x = 99;
  const read = world.events.events();
  if (read[0].type === 'combat.attack') read[0].direction.x = 77;
  expect(world.events.events()).toEqual([expected]);
  world.events.dispose();
});
