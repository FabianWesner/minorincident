import { expect, test, vi } from 'vitest';
import { InfectedSystem } from '../../../src/sim/ai/InfectedSystem';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { InfectedState } from '../../../src/sim/ai/types';
import type { L1Brain } from '../../../src/sim/ai/Search';

test.each([
  { before: 1.04, after: .99, visible: true, grabs: 1 },
  { before: 1.04, after: 1.01, visible: true, grabs: 0 },
  { before: 1.04, after: .99, visible: false, grabs: 0 },
  { before: .99, after: .99, visible: true, grabs: 1 },
])('civilian grabs resolve actual contact after steering: %j', ({ before, after, visible, grabs }) => {
  const target = { id: 11, kind: 'civilian', position: { x: 0, z: 0 } };
  const runner = { transform: { x: before, z: 0 }, combat: { radius: .35 } } as EntitySnapshot;
  const brain = { targetId: 11, pauseUntil: 0, runSpeed: 3 } as L1Brain;
  const startBite = vi.fn(), steerL1 = vi.fn(() => { runner.transform.x = after; });
  const ai = Object.assign(Object.create(InfectedSystem.prototype), {
    world: { tick: 60, entities: { get: () => ({ combat: { radius: .35 } }) } },
    l1: { humans: { get: () => target }, lineOfSight: () => visible }, startBite, steerL1,
  }) as { chaseL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void };
  ai.chaseL1(runner, {} as InfectedState, brain);
  expect(startBite).toHaveBeenCalledTimes(grabs);
  if (before > 1) expect(steerL1).toHaveBeenCalledOnce(); else expect(steerL1).not.toHaveBeenCalled();
});
