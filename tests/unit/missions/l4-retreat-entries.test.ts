import { expect, test, vi } from 'vitest';
import { LevelFourWar } from '../../../src/sim/missions/LevelFourWar';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('L4 high retreat cohorts use exterior street mouths and retain courier pressure', () => {
  const player = { id: 1, transform: { x: -23, z: 0 } } as EntitySnapshot;
  const soldiers = [{ id: 11, transform: { x: 28, z: -37 } }, { id: 12, transform: { x: -70, z: 45 } }] as EntitySnapshot[];
  const bodies = new Map<number, EntitySnapshot>();
  const state = { phase: 'collapse', perimeterAt: 1, perimeterPending: 12, perimeterCursor: 0, emergedIds: [], origin: {} };
  let next = 100;
  const emerge = vi.fn(() => { const id = next++; bodies.set(id, { infected: { l1: { search: {} } } } as EntitySnapshot); return id; });
  const ai = { director: { tier: 'high', cap: 120, count: 0, reserved: 0, pendingTurns: 0, offscreen: () => true }, press: vi.fn() };
  const war = Object.assign(Object.create(LevelFourWar.prototype), {
    mission: { state: { l4: state }, world: { tick: 200, seed: 2, infected: ai, entities: { get: (id: number) => id === 1 ? player : bodies.get(id) } } },
    director: { aliveShare: () => 1 }, headroom: () => 0, streetReserve: () => 0,
    snap: (p: unknown) => p, breachOpen: () => true, liveSoldiers: () => soldiers, emerge,
  }) as { emergePerimeterPressure(): void };
  war.emergePerimeterPressure();
  const points = emerge.mock.calls as unknown as [{ x: number; z: number }][];
  expect(points.some(([p]) => p.x > 20 && p.z < -40)).toBe(true);
  expect(points.some(([p]) => p.x < -70 && p.z > 50)).toBe(true);
  // Breach cohorts keep contact with the courier; separate street waves and
  // surviving Alphas pursue the retreating army.
  expect(ai.press).toHaveBeenCalled();
  expect(ai.press.mock.calls.every(c => c[1] === 1)).toBe(true);
  expect(state.perimeterPending).toBe(0);
});
