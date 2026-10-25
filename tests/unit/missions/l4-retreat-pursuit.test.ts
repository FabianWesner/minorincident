import { expect, test, vi } from 'vitest';
import { LevelFourWar } from '../../../src/sim/missions/LevelFourWar';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('L4 pursuit follows a moving defender after completing an approach outside the perimeter', () => {
  const player = { id: 1, transform: { x: 0, z: 0 } } as EntitySnapshot;
  const soldier = { id: 11, transform: { x: 50, z: 0 } } as EntitySnapshot;
  const brain = { mode: 'wander', targetId: 0, focusId: 11, focusUntil: 99999, goalX: 40, goalZ: 0, search: { completeApproach: true } };
  const runner = { id: 60, archetype: 'infected.runner', transform: { x: 30, z: 0 }, health: { current: 100 }, infected: { l1: brain } } as unknown as EntitySnapshot;
  const press = vi.fn(), world = { tick: 60, entities: { get: () => player }, infected: { active: [runner], press, director: { tier: 'high' } } };
  const war = Object.assign(Object.create(LevelFourWar.prototype), {
    mission: { world, state: { l4: { phase: 'collapse' } } }, liveSoldiers: () => [soldier], insideRing: () => false,
  }) as { followBreachHorde(): void };
  war.followBreachHorde();
  expect(press).toHaveBeenCalledWith(60, 11, expect.any(Number), 30);
  expect(brain.goalX).toBe(50); expect(brain.goalZ).toBe(0);
  expect(brain.search.completeApproach).toBe(true);
});


test('L4 excess pursuers cover another defender while coherent cohorts keep their assignment', () => {
  const player = { id: 1, transform: { x: 0, z: 0 } } as EntitySnapshot;
  const soldiers = [11, 12].map((id, i) => ({ id, transform: { x: 50 + i * 10, z: 0 } } as EntitySnapshot));
  const active = Array.from({ length: 20 }, (_, i) => ({ id: 60 + i, archetype: 'infected.runner', transform: { x: 30, z: 0 }, health: { current: 100 }, infected: { l1: { mode: 'wander', focusId: 11, goalX: 50, goalZ: 0, search: {} } } } as unknown as EntitySnapshot));
  const press = vi.fn(), world = { tick: 60, entities: { get: () => player }, infected: { active, press, director: { tier: 'high' } } };
  const war = Object.assign(Object.create(LevelFourWar.prototype), {
    mission: { world, state: { l4: { phase: 'collapse' } } }, liveSoldiers: () => soldiers, insideRing: () => false,
  }) as { followBreachHorde(): void };
  war.followBreachHorde();
  expect(press).toHaveBeenCalledWith(60, 12, expect.any(Number), 30);
  expect(active[0].infected!.l1!.goalX).toBe(60);
});

