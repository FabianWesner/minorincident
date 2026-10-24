import { expect, test, vi } from 'vitest';
import { l4Edges } from '../../../src/data/l4';
import { LevelFourWar } from '../../../src/sim/missions/LevelFourWar';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('L4 high collapse rotates edge priority when only one live slot opens', () => {
  const player = { transform: { x: -22.85, z: .7 } } as EntitySnapshot;
  const soldier = { id: 11, transform: { x: 50, z: 40 } } as EntitySnapshot;
  const state = { phase: 'collapse', pend: [2, 2, 0, 0, 0, 0, 0], collapseIds: [] as number[], emergedIds: [] as number[], collapseEdgeCursor: 0 };
  const ai = { director: { tier: 'high', offscreen: () => true }, hearing: { humans: { get: () => true } }, press: vi.fn(), rush: vi.fn() };
  let room = 1, nextId = 100;
  const mission = { state: { l4: state }, world: { tick: 200, entities: { get: (id: number) => id === 1 ? player : undefined }, infected: ai } };
  const war = Object.assign(Object.create(LevelFourWar.prototype), {
    mission, spectacle: { edgePoint: (i: number) => ({ x: l4Edges[i].at[0], z: l4Edges[i].at[1] }) },
    liveSoldiers: () => [soldier], inGap: () => false, snap: (p: unknown) => p,
    emerge: () => room-- > 0 ? nextId++ : 0,
  }) as { flushEdges(): void };
  war.flushEdges();
  expect(state.pend.slice(0, 2)).toEqual([1, 2]); expect(state.collapseEdgeCursor).toBe(1);
  mission.state.l4 = structuredClone(state); room = 1; war.flushEdges();
  expect(mission.state.l4.pend.slice(0, 2)).toEqual([1, 1]);
  expect(mission.state.l4.collapseIds).toEqual([100, 101]);
});
