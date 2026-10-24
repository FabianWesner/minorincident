import { expect, test, vi } from 'vitest';
import { LevelFourWar } from '../../../src/sim/missions/LevelFourWar';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('L4 high retreat cohorts reach authored street mouths beside distant surviving posts', () => {
  const player = { id: 1, transform: { x: -23, z: 0 } } as EntitySnapshot;
  const soldiers = [{ id: 11, transform: { x: 28, z: -37 } }, { id: 12, transform: { x: -70, z: 45 } }] as EntitySnapshot[];
  const bodies = new Map<number, EntitySnapshot>();
  const state = { phase: 'collapse', insideAt: 1, insidePending: 12, insideCursor: 0, emergedIds: [], origin: {} };
  let next = 100;
  const emerge = vi.fn(() => { const id = next++; bodies.set(id, { infected: { l1: { search: {} } } } as EntitySnapshot); return id; });
  const ai = { director: { tier: 'high', cap: 120, count: 0, reserved: 0, pendingTurns: 0, offscreen: () => true }, press: vi.fn() };
  const war = Object.assign(Object.create(LevelFourWar.prototype), {
    mission: { state: { l4: state }, world: { tick: 200, seed: 2, infected: ai, entities: { get: (id: number) => id === 1 ? player : bodies.get(id) } } },
    director: { aliveShare: () => 1 }, headroom: () => 0, streetReserve: () => 0,
    snap: (p: unknown) => p, breachOpen: () => true, liveSoldiers: () => soldiers, emerge,
  }) as { emergeInside(): void };
  war.emergeInside();
  const points = emerge.mock.calls as unknown as [{ x: number; z: number }][];
  expect(points.some(([p]) => p.x > 20 && p.z < -40)).toBe(true);
  expect(points.some(([p]) => p.x < -70 && p.z > 50)).toBe(true);
  expect(ai.press.mock.calls.some(c => c[1] === 11)).toBe(true);
  expect(ai.press.mock.calls.some(c => c[1] === 12)).toBe(true);
  expect(state.insidePending).toBe(0);
});
