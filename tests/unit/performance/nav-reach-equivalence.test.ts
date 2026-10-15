import { expect, test } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

type Bounds = { x0: number; x1: number; z0: number; z1: number } | null;
/** Plain BFS oracle: world-space perimeter checks and direct squared offsets,
 * with independent Map/array storage and the established left/right/up/down tie order. */
function reference(grid: NavGrid, from: number, target: { x: number; z: number }, bounds: Bounds) {
  const parent = new Map([[from, -1]]), depth = new Map([[from, 0]]), queue = [from];
  const tx = (target.x - grid.center.x + grid.ground.width / 2) / grid.cellSize - .5;
  const tz = (target.z - grid.center.z + grid.ground.depth / 2) / grid.cellSize - .5;
  let best = from, bestD = Infinity, far = -1, farD = Infinity, expanded = 0;
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head], x = cell % grid.width, z = Math.floor(cell / grid.width);
    const d = (x - tx) ** 2 + (z - tz) ** 2, steps = depth.get(cell)!; expanded++;
    if (d < bestD) { best = cell; bestD = d; }
    if (d < .5 && steps >= 4) break;
    if (steps >= 8 && d < farD) { far = cell; farD = d; }
    for (const [nx, nz] of [[x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1]]) {
      if (nx < 0 || nx >= grid.width || nz < 0 || nz >= grid.depth) continue;
      const next = nz * grid.width + nx, wx = grid.x(next), wz = grid.z(next), r = grid.clearance;
      if (grid.blocked[next] || parent.has(next) || bounds && !(wx >= bounds.x0 + r && wx <= bounds.x1 - r && wz >= bounds.z0 + r && wz <= bounds.z1 - r)) continue;
      parent.set(next, cell); depth.set(next, steps + 1); queue.push(next);
    }
  }
  if (depth.get(best)! < 4 && far >= 0 && bestD > 4) best = far;
  const path: number[] = [];
  while (best !== from && best >= 0) { path.push(best); best = parent.get(best)!; }
  return { path: path.reverse(), expanded };
}

for (const center of [{ x: 0, z: 0 }, { x: 3980.125, z: -26.375 }]) for (const bounded of [false, true]) {
  test(`@E18 @E32 reach flood preserves paths, ties and budgets at ${center.x}, perimeter ${bounded}`, () => {
    const wall = { x: center.x + 1, z: center.z, y: 1, halfX: .2, halfY: 1, halfZ: 6 };
    const grid = new NavGrid({ width: 24, depth: 18 }, [wall], .45, { ...center });
    const bounds = bounded ? { x0: center.x - 8, x1: center.x + 8, z0: center.z - 7, z1: center.z + 7 } : null;
    grid.setPlayerBounds(bounds);
    const from = grid.cell(center.x - 3, center.z);
    // Reachable, outside the window, blocked, coincident, symmetric and fractional targets.
    const targets = [[8, 0], [0, 12], [-3, 0], [1, 0], [-3, 15], [8.137, -7.913], [-8.25, .25]];
    for (const [dx, dz] of targets) for (const budget of [1, 7, 1600, Infinity]) {
      const target = { x: center.x + dx, z: center.z + dz }, expected = reference(grid, from, target, bounds), path: number[] = [];
      let calls = 1;
      while (!grid.reachPath(from, target, path, budget)) { calls++; expect(calls).toBeLessThan(2000); }
      expect(path).toEqual(expected.path);
      expect(calls).toBe(Number.isFinite(budget) ? Math.ceil(expected.expanded / budget) : 1);
    }
    // A blocker change and stream-window recenter must use fresh distances/geometry.
    grid.setBlocker(7, { ...wall, x: center.x - 2, halfZ: 2 }, true);
    for (const [dx, dz] of targets) {
      const target = { x: center.x + dx, z: center.z + dz }, path: number[] = [];
      expect(grid.reachPath(from, target, path)).toBe(true);
      expect(path).toEqual(reference(grid, from, target, bounds).path);
    }
    grid.setPlayerBounds(null); grid.recenter({ x: center.x + 3, z: center.z - 2 });
    const start = grid.nearestCell(center.x - 4, center.z - 2), target = { x: center.x + 11, z: center.z + 7 }, path: number[] = [];
    expect(grid.reachPath(start, target, path)).toBe(true);
    expect(path).toEqual(reference(grid, start, target, null).path);
  });
}

test('@E18 resumed reach flood retains its original target and prepends its start when the player moves', () => {
  const grid = new NavGrid({ width: 20, depth: 20 }, []), from = grid.cell(-5, -5);
  const target = { x: 4.1, z: 4.1 }, expected = reference(grid, from, target, null), path: number[] = [];
  expect(grid.reachPath(from, target, path, 1)).toBe(false);
  // Same target cell keeps the in-progress request, including its fractional offset.
  expect(grid.reachPath(from + 1, { x: 4.2, z: 4.2 }, path)).toBe(true);
  expect(path).toEqual([from, ...expected.path]);
});

test('@E32 repeated unbudgeted floods reuse only exact answers and copy the returned path', () => {
  const wall = { x: 1, z: 0, y: 1, halfX: .2, halfY: 1, halfZ: 6 };
  const grid = new NavGrid({ width: 24, depth: 18 }, [wall]), from = grid.cell(-3, 0), target = { x: 1, z: 0 }, path: number[] = [];
  const expected = reference(grid, from, target, null).path;
  const state = grid as unknown as { reachStamp: number };
  expect(grid.reachPath(from, target, path)).toBe(true);
  const stamp = state.reachStamp;
  for (let i = 0; i < 5; i++) {
    path.length = 0; path.push(-999);
    expect(grid.reachPath(from, target, path)).toBe(true); expect(path).toEqual(expected);
    expect(state.reachStamp).toBe(stamp);
  }
  // Fractional targets within the same cell are different completed requests.
  const shifted = { x: 1.01, z: .01 };
  expect(grid.reachPath(from, shifted, path)).toBe(true);
  expect(path).toEqual(reference(grid, from, shifted, null).path); expect(state.reachStamp).toBe(stamp + 1);
  // An existing memo must not make a finite-budget request finish early.
  expect(grid.reachPath(from, shifted, path, 1)).toBe(false);
  expect(grid.reachPath(from, shifted, path)).toBe(true);
  expect(path).toEqual(reference(grid, from, shifted, null).path);
});

test('@E32 exact flood memo invalidates for blocker edits, perimeter changes, rebakes and recentering', () => {
  const wall = { x: 0, z: 0, y: 1, halfX: .2, halfY: 1, halfZ: 3 };
  const walls: typeof wall[] = [], grid = new NavGrid({ width: 24, depth: 18 }, walls);
  const from = grid.cell(-5, 0), target = { x: 5, z: 0 }, path: number[] = [];
  let bounds: Bounds = null;
  const check = () => {
    const expected = reference(grid, from, target, bounds).path;
    expect(grid.reachPath(from, target, path)).toBe(true); expect(path).toEqual(expected);
    path.length = 0; expect(grid.reachPath(from, target, path)).toBe(true); expect(path).toEqual(expected);
  };
  check();
  grid.setBlocker(7, wall, true); check();
  wall.z = 5; grid.setBlocker(7, wall, true); check();
  grid.setBlocker(7, wall, false); check();
  bounds = { x0: -10, x1: 1, z0: -7, z1: 7 }; grid.setPlayerBounds(bounds); check();
  bounds = null; grid.setPlayerBounds(null); check();
  walls.push({ ...wall, z: 0 }); grid.rebake(); check();
  grid.recenter({ x: 3, z: 2 }); check();
});
