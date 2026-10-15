import { expect, test, vi } from 'vitest';
import { LevelTwoBot } from '../../../src/debug/bot/LevelTwoBot';
import { Walker } from '../../../src/debug/bot/Walker';
import type { SimWorld } from '../../../src/sim/world/SimWorld';

test.each([false, true])('@E20 completion recovery ignores a collected health pickup: %s', collected => {
  const player = { id: 1, transform: { x: 0, z: 0 }, health: { current: 50, max: 100 } };
  const kit = { id: 2, transform: { x: 1, z: 0 }, pickup: { kind: 'medkit', collected } };
  const world = {
    seed: 1, tick: 600,
    entities: { get: () => player, iterate: function* () { yield player; yield kit; } },
    infected: { active: [] },
    missions: { state: { phase: 'active', l2: { phase: 'escape', doorsOpenAt: 1 } }, def: { anchors: {} } },
  } as unknown as SimWorld;
  const step = vi.spyOn(Walker.prototype, 'step').mockReturnValue({ x: 1, z: 0 });
  try {
    const frame = new LevelTwoBot(world).sample();
    expect(frame.move).toEqual({ x: 1, z: 0 });
    expect(step.mock.calls.at(-1)![3]).toMatch(collected ? /^route-/ : /^heal-2$/);
  } finally { step.mockRestore(); }
});
