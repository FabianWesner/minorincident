import { expect, test, vi } from 'vitest';
import { freshDirector, L4Collapse, type CollapseHost } from '../../../src/sim/missions/L4Collapse';
import type { L4State } from '../../../src/sim/missions/types';
import type { EntitySnapshot } from '../../../src/sim/world/types';

test('L4 waits for enough concurrency slots to admit its whole retreat cohort', () => {
  const director = freshDirector();
  Object.assign(director, { cutOff: [11, 12, 13], cutOffPending: 6, cutOffSource: { x: 20, z: 0 } });
  const soldiers = [11, 12, 13].map(id => ({ id, transform: { x: 10, z: id - 12 }, health: { current: 120 }, civilian: {} } as EntitySnapshot));
  const press = vi.fn(), state = { director, soldierIds: [11, 12, 13] } as L4State;
  let room = 3, nextId = 100;
  const host = { s: () => state, low: () => false, snap: (p: { x: number; z: number }) => p,
    human: (e?: EntitySnapshot) => !!e && e.health.current > 0,
    emerge: () => room > 0 ? (room--, nextId++) : 0,
    mission: { world: { tick: 200, entities: { get: (id: number) => soldiers.find(e => e.id === id) }, infected: { press, director: { cap: 120, reserved: 0, pendingTurns: 0, get count() { return 120 - room; } } } } } } as unknown as CollapseHost;
  const collapse = new L4Collapse(host);
  collapse.releaseCutOff();
  expect(director.cutOffPending).toBe(6); expect(press).not.toHaveBeenCalled();
  room = 6; collapse.releaseCutOff();
  expect(director.cutOffPending).toBe(0); expect(director.spawned).toBe(6);
  expect(press.mock.calls.map(c => c[0])).toEqual([100, 101, 102, 103, 104, 105]);
  expect(press.mock.calls.map(c => c[1])).toEqual([11, 12, 13, 11, 12, 13]);
});
