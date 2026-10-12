import { expect, test, vi } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { ScenarioDefinition } from '../../../src/levels/loader';
type Wall = NonNullable<ScenarioDefinition['walls']>[number];
// Original main algorithm: compare exact results across samples, slabs and dynamic blockers.
function legacyVisible(this: Pick<NavGrid, 'mask' | 'walls' | 'ground' | 'center' | 'clear'> & { buckets: Map<string, Wall[]>; blockers: Map<number, Wall> }, from: { x: number; z: number }, to: { x: number; z: number }, radius: number): boolean {
    if (!this.mask && !this.walls.length && !this.blockers.size) return this.clear(to.x, to.z, radius);
    const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) / 0.2);
    if (!this.clear(to.x, to.z, radius)) return false;
    const walls = new Set(this.blockers.values());
    for (let i = 0; i <= steps; i++) {
      const x = from.x + dx * i / Math.max(1, steps), z = from.z + dz * i / Math.max(1, steps);
      if (this.mask && !this.mask(x, z)) return false;
      if (Math.abs(x - this.center.x) + radius >= this.ground.width / 2 || Math.abs(z - this.center.z) + radius >= this.ground.depth / 2) return false;
      for (const wall of this.buckets.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) walls.add(wall);
    }
    // Sampled clearance alone can skip a corner between two samples. A pulled
    // waypoint must clear the entire segment, including narrow foliage boxes.
    for (const wall of walls) {
      const minX = wall.x - wall.halfX - radius, maxX = wall.x + wall.halfX + radius;
      const minZ = wall.z - wall.halfZ - radius, maxZ = wall.z + wall.halfZ + radius;
      // Rapier's rounded capsule can rest inside a conservative expanded box
      // corner. Permit an outward escape, never a route through the solid.
      if (from.x > minX && from.x < maxX && from.z > minZ && from.z < maxZ &&
        ((from.x <= wall.x && to.x <= minX) || (from.x >= wall.x && to.x >= maxX) ||
         (from.z <= wall.z && to.z <= minZ) || (from.z >= wall.z && to.z >= maxZ))) continue;
      let enter = 0, leave = 1;
      for (const [start, delta, center, half] of [[from.x, dx, wall.x, wall.halfX], [from.z, dz, wall.z, wall.halfZ]]) {
        const min = center - half - radius, max = center + half + radius;
        if (delta === 0) { if (start <= min || start >= max) { leave = -1; break; } }
        else {
          const a = (min - start) / delta, b = (max - start) / delta;
          enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
        }
      }
      if (enter < leave) return false;
    }
    return true;
  }

test('@E20 navigation visibility keeps the original sample and slab decisions', () => {
  let seed = 17; const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed / 4294967296; };
  const walls = Array.from({ length: 25 }, () => ({ x: random() * 32 - 16, y: 1, z: random() * 32 - 16, halfX: .02 + random() * 2, halfY: 1, halfZ: .02 + random() * 2 }));
  const nav = new NavGrid({ width: 48, depth: 48 }, walls, .65, { x: 1, z: -1 }, (x, z) => !(x > 8 && x < 10 && z > 5 && z < 7));
  // Keep the original string index independent of the production numeric index.
  const buckets = new Map<string, Wall[]>();
  for (const wall of walls) for (let z = Math.floor((wall.z - wall.halfZ - 2) / 4); z <= Math.floor((wall.z + wall.halfZ + 2) / 4); z++) for (let x = Math.floor((wall.x - wall.halfX - 2) / 4); x <= Math.floor((wall.x + wall.halfX + 2) / 4); x++) {
    const key = `${x},${z}`, bucket = buckets.get(key) ?? []; bucket.push(wall); buckets.set(key, bucket);
  }
  const legacy = legacyVisible.bind({ mask: nav.mask, walls, ground: nav.ground, center: nav.center,
    clear: nav.clear.bind(nav), buckets, blockers: (nav as unknown as { blockers: Map<number, Wall> }).blockers });
  for (let i = 0; i < 3000; i++) {
    if (i % 100 === 0) nav.setBlocker(99, { x: i % 9, y: 1, z: i % 7, halfX: .1, halfY: 1, halfZ: 2 }, i % 200 === 0);
    const from = { x: random() * 50 - 25, z: random() * 50 - 25 }, to = { x: random() * 50 - 25, z: random() * 50 - 25 };
    if (i % 3 === 0) to.x = from.x; if (i % 5 === 0) to.z = from.z;
    const radius = [0, .1, .35, .65, 1.2][i % 5];
    expect(nav.visible(from, to, radius), JSON.stringify({ from, to, radius })).toBe(legacy(from, to, radius));
  }
});

test('@E20 blocker changes keep only unaffected nearest-cell answers', () => {
  const wall = { x: -12, y: 1, z: -12, halfX: .4, halfY: 1, halfZ: .4 };
  const nav = new NavGrid({ width: 48, depth: 48 }, [wall]);
  const uncached = (nav as unknown as { nearestCellUncached(x: number, z: number, radius?: number): number }).nearestCellUncached.bind(nav);
  const far = nav.nearestCell(-12, -12, .35);
  const memo = (nav as unknown as { nearestMemo: { x: number; z: number }[] }).nearestMemo;
  nav.setBlocker(99, { ...wall, x: 10, z: 10 }, true);
  expect(memo.some(m => m.x === -12 && m.z === -12)).toBe(true);
  expect(nav.nearestCell(-12, -12, .35)).toBe(far);
  for (let i = 0; i < 40; i++) {
    const blocker = { ...wall, x: -12 + i % 6, z: -12 + i % 5, halfX: .8, halfZ: .2 };
    nav.setBlocker(99, blocker, i % 3 !== 0);
    for (const [x, z] of [[-12, -12], [-10, -10], [0, 0], [10, 10]]) for (const radius of [undefined, 0, .35, 1.2]) {
      expect(nav.nearestCell(x, z, radius)).toBe(uncached(x, z, radius));
    }
  }
  const mutable = { ...wall };
  nav.setBlocker(101, mutable, true);
  for (let i = 0; i < 10; i++) {
    if (i % 3 === 0) nav.rebake();
    nav.nearestCell(mutable.x, mutable.z, .35);
    mutable.x += .5; mutable.z += .5;
    nav.setBlocker(101, mutable, i % 2 === 0);
    for (const offset of [-1, 0, 1]) expect(nav.nearestCell(mutable.x + offset, mutable.z, .35)).toBe(uncached(mutable.x + offset, mutable.z, .35));
  }
});

test('@E18 morning route targets reuse exact nearest-cell answers across ticks', () => {
  const nav = new NavGrid({ width: 48, depth: 48 }, []);
  const internal = nav as unknown as { nearestCellUncached(x: number, z: number, radius?: number): number };
  const uncached = internal.nearestCellUncached.bind(nav), miss = vi.spyOn(internal, 'nearestCellUncached');
  const targets = Array.from({ length: 32 }, (_, i) => ({ x: -8 + i * .5, z: 0 }));
  const answers = targets.map(p => nav.nearestCell(p.x, p.z, .35));
  for (let tick = 0; tick < 5; tick++) expect(targets.map(p => nav.nearestCell(p.x, p.z, .35))).toEqual(answers);
  expect(miss).toHaveBeenCalledTimes(targets.length);
  nav.setBlocker(9, { x: 0, z: 0, y: 1, halfX: 1, halfZ: 1, halfY: 1 }, true);
  for (const p of targets) expect(nav.nearestCell(p.x, p.z, .35)).toBe(uncached(p.x, p.z, .35));
});

test('@E18 nearest-cell pruning preserves the full scan and its tie order', () => {
  const nav = new NavGrid({ width: 32, depth: 32 }, [{ x: 0, z: 0, y: 1, halfX: 2, halfZ: 2, halfY: 1 }]);
  const legacy = (x: number, z: number, radius?: number) => {
    const reachable = (cell: number) => radius === undefined || nav.visible({ x, z }, { x: nav.x(cell), z: nav.z(cell) }, radius);
    const cell = nav.cell(x, z); if (cell < 0 || !nav.blocked[cell] && reachable(cell)) return cell;
    let nearest = -1, distance = Infinity;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
      const candidate = nav.cell(x + dx * nav.cellSize, z + dz * nav.cellSize);
      if (candidate < 0 || nav.blocked[candidate] || !reachable(candidate)) continue;
      const d = (nav.x(candidate) - x) ** 2 + (nav.z(candidate) - z) ** 2;
      if (d < distance) { nearest = candidate; distance = d; }
    }
    return nearest;
  };
  for (let i = 0; i < 1200; i++) {
    if (i % 100 === 0) nav.setBlocker(9, { x: i % 7 - 3, z: i % 9 - 4, y: 1, halfX: .8, halfZ: .2, halfY: 1 }, i % 200 === 0);
    const x = (i * 137 % 340) / 10 - 17, z = (i * 79 % 340) / 10 - 17, radius = [undefined, 0, .35, 1.2][i % 4];
    expect(nav.nearestCell(x, z, radius)).toBe(legacy(x, z, radius));
  }
});


// Keep the original A* implementation as an exact oracle, including heap tie order and retries.
type LegacySearch = Pick<NavGrid, 'blocked' | 'width' | 'expansions'> & {
  searching: boolean; searchFrom: number; searchTo: number; heap: { cell: number; score: number }[];
  cost: Float64Array; parent: Int32Array; open: Uint8Array;
  push(cell: number, score: number): void; pop(): number; neighbor(cell: number, direction: number): number;
};
function legacyPath(this: LegacySearch, from: number, to: number, result: number[], budget: number): boolean {
    result.length = 0; this.expansions = 0;
    if (from < 0 || to < 0 || this.blocked[from] || this.blocked[to]) return false;
    if (!this.searching || this.searchFrom !== from || this.searchTo !== to) {
      this.searchFrom = from; this.searchTo = to; this.searching = true;
      this.heap.length = 0; this.push(from, 0);
      this.cost.fill(Infinity); this.parent.fill(-1); this.open.fill(0); this.cost[from] = 0; this.open[from] = 1;
    }
    const tx = to % this.width, tz = Math.floor(to / this.width);
    while (this.expansions < budget) {
      let best = -1;
      while (this.heap.length) { const candidate = this.pop(); if (this.open[candidate] === 1) { best = candidate; break; } }
      if (best < 0) { this.searching = false; return false; }
      this.expansions++; this.open[best] = 2;
      if (best === to) { this.searching = false; for (let cell = to; cell !== from; cell = this.parent[cell]) result.push(cell); result.reverse(); return true; }
      for (let d = 0; d < 4; d++) { const n = this.neighbor(best, d); if (n >= 0 && !this.blocked[n] && this.open[n] !== 2 && this.cost[best] + 1 < this.cost[n]) { this.cost[n] = this.cost[best] + 1; this.parent[n] = best; this.open[n] = 1; this.push(n, this.cost[n] + (Math.abs(n % this.width - tx) + Math.abs(Math.floor(n / this.width) - tz)) * 1.00001); } }
    }
    return false;
  }

test('@E20 stamped A* matches the original routes and expansion budgets across retries and resets', () => {
  const wall = { x: 0, z: 0, y: 1, halfX: .3, halfZ: 8, halfY: 1 };
  const current = new NavGrid({ width: 30, depth: 30 }, [wall]), original = new NavGrid({ width: 30, depth: 30 }, [wall]);
  const legacy = legacyPath.bind(original as unknown as LegacySearch);
  let seed = 39; const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed / 4294967296; };
  const actual: number[] = [], expected: number[] = [];
  for (let i = 0; i < 300; i++) {
    if (i % 30 === 0) for (const nav of [current, original]) nav.setBlocker(99, { ...wall, x: -3, z: i % 7 }, i % 60 === 0);
    // Force the generation counter's wrap, which must clear stamps without changing the route.
    if (i === 150) (current as unknown as { pathStamp: number }).pathStamp = 0xffffffff;
    const from = current.cell(random() * 28 - 14, random() * 28 - 14), to = current.cell(random() * 28 - 14, random() * 28 - 14);
    const budget = [1, 3, 10, 1600][i % 4];
    for (let retry = 0; retry < 12; retry++) {
      const done = current.path(from, to, actual, budget);
      expect(done).toBe(legacy(from, to, expected, budget));
      expect(actual).toEqual(expected); expect(current.expansions).toBe(original.expansions);
      if (done) break;
    }
  }
});

test('live furniture broad phase follows replacement, in-place movement, removal and rebake', () => {
  const nav = new NavGrid({ width: 80, depth: 80 }, []);
  const wall = { x: -20, y: 1, z: 0, halfX: .5, halfY: 1, halfZ: 1 };
  nav.setBlocker(91, wall, true);
  expect(nav.clear(-20, 0, .35)).toBe(false);
  expect(nav.visible({ x: -22, z: 0 }, { x: -18, z: 0 }, .35)).toBe(false);
  wall.x = 20; nav.setBlocker(91, wall, true);
  expect(nav.clear(-20, 0, .35)).toBe(true);
  expect(nav.blocked[nav.cell(-20, 0)]).toBe(0);
  expect(nav.clear(20, 0, .35)).toBe(false);
  expect(nav.visible({ x: 18, z: 0 }, { x: 22, z: 0 }, .35)).toBe(false);
  nav.rebake(); expect(nav.clear(20, 0, .35)).toBe(false);
  const replacement = { ...wall, z: 10 }; nav.setBlocker(91, replacement, true);
  expect(nav.clear(20, 0, .35)).toBe(true);
  expect(nav.clear(20, 10, .35)).toBe(false);
  expect(nav.clear(20, 10, .35, false, 91)).toBe(true);
  nav.setBlocker(91, replacement, false);
  expect(nav.clear(20, 10, .35)).toBe(true);
  expect(nav.visible({ x: 18, z: 10 }, { x: 22, z: 10 }, .35)).toBe(true);
});

test('@E21 elevated road blockers remain in navigation while overhead roofs stay clear', () => {
  const wall = { x: 0, y: 6, z: 0, halfX: .3, halfY: .5, halfZ: 4 };
  const nav = new NavGrid({width:24,depth:24}, [wall]);
  const from={x:-4,z:0}, to={x:4,z:0};
  expect(nav.visible(from,to,.45)).toBe(true);
  const road = new NavGrid({width:24,depth:24}, [{...wall,navBlocker:true}]);
  expect(road.clear(0,0,.45)).toBe(false);
  expect(road.visible(from,to,.45)).toBe(false);
  road.rebake();
  expect(road.visible(from,to,.45)).toBe(false);
});
