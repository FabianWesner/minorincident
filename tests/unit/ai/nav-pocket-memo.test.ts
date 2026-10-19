import { expect, test } from 'vitest';
import { Rng } from '../../../src/core/Rng';
import { NavGrid, type Wall } from '../../../src/sim/ai/NavGrid';

const wall = (x: number, z: number, halfX: number, halfZ: number): Wall => ({ x, y: .9, z, halfX, halfZ, halfY: .9 } as Wall);

test('T-E22-20-pocket @E22-AC20 a repeated unreachable A* returns what a fresh search returns, with the same visited pocket and sizes', () => {
  // A walled yard (closed box) inside an open square: every goal inside it is unreachable from outside, and vice versa.
  const walls = [wall(10, 0, .3, 8), wall(26, 0, .3, 8), wall(18, -8, 8, .3), wall(18, 8, 8, .3), wall(-20, 10, 6, .4)];
  const memo = new NavGrid({ width: 120, depth: 80 }, walls), fresh = new NavGrid({ width: 120, depth: 80 }, walls);
  const rng = new Rng(3, 'pocket'), result: number[] = [], other: number[] = [];
  const pick = (inside: boolean) => {
    for (;;) {
      const x = inside ? 12 + rng.next() * 12 : -55 + rng.next() * 60, z = inside ? -6 + rng.next() * 12 : -35 + rng.next() * 70;
      const cell = memo.nearestCell(x, z, .35); if (cell >= 0) return cell;
    }
  };
  let shortcuts = 0;
  for (let i = 0; i < 400; i++) {
    const from = pick(i % 7 === 3), to = pick(i % 7 !== 3 && i % 3 !== 0), budget = [1600, 48_000, 48_000, 200_000][i % 4];
    // Mid-run grid changes (a door, a parked car) must invalidate the remembered pocket.
    if (i % 50 === 25) for (const nav of [memo, fresh]) nav.setBlocker(1, wall(-10 + i % 3, 0, 1, 1), i % 100 === 25);
    (fresh as unknown as { failSeen: null }).failSeen = null;
    const stamp = () => (memo as unknown as { pathStamp: number }).pathStamp, wasPending = memo.pending(from, to), before = stamp(), a = memo.path(from, to, result, budget), b = fresh.path(from, to, other, budget);
    expect(a, `${i}`).toBe(b); expect(result).toEqual(other);
    expect(memo.expansions, `${i}`).toBe(fresh.expansions); expect(memo.searchSize).toBe(fresh.searchSize); expect(memo.pending(from, to)).toBe(fresh.pending(from, to));
    // escapeCell reads the last search's visited cells.
    const at = { x: memo.x(from) + .2, z: memo.z(from) - .1 };
    expect(memo.escapeCell(at, .3, 6)).toBe(fresh.escapeCell(at, .3, 6));
    if (!wasPending && stamp() <= before && !(memo.blocked[from] || memo.blocked[to])) shortcuts++;
  }
  expect(shortcuts).toBeGreaterThan(50);
});
