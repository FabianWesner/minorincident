import { expect, test, vi } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

test('T-E22-20-expansion @E22-AC20 each A* expansion decodes its row once while retaining budgeted route order', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, []), from = nav.cell(-8, -8), to = nav.cell(8, 8), route: number[] = [];
  const floor = vi.spyOn(Math, 'floor'); let calls = 0;
  try { expect(nav.path(from, to, route, 10000)).toBe(true); calls = floor.mock.calls.length; }
  finally { floor.mockRestore(); }
  expect(calls, 'neighbor and heuristic coordinates must reuse the expanded cell row').toBeLessThanOrEqual(nav.expansions + 1);
  expect(route.at(-1)).toBe(to);
  const resumed = new NavGrid({ width: 20, depth: 20 }, []), result: number[] = [];
  while (!resumed.path(from, to, result, 7)) expect(resumed.pending(from, to)).toBe(true);
  expect(result).toEqual(route);
});

test('reach search decodes one row per visited cell when no player bounds need coordinate tests', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, []), from = nav.cell(-8, -8), to = nav.cell(8, 8), target = { x: nav.x(to), z: nav.z(to) }, result: number[] = [];
  const floor = vi.spyOn(Math, 'floor'); let calls = 0;
  try { expect(nav.reachPath(from, target, result)).toBe(true); calls = floor.mock.calls.length; }
  finally { floor.mockRestore(); }
  const visited = (nav as unknown as { reach: { head: number } }).reach.head;
  expect(calls).toBeLessThanOrEqual(visited + 2);
  expect(result.at(-1)).toBe(nav.cell(target.x, target.z));
});
