import { expect, test } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
import type { ScenarioDefinition } from '../../../src/levels/loader';
const walls: NonNullable<ScenarioDefinition['walls']> = [
  { x: 4.12, z: -7.27, y: .8, halfX: 1.03, halfZ: .14, halfY: .8 },
  { x: 5.3, z: -7, y: .8, halfX: .3, halfZ: 1.15, halfY: .8 },
  { x: -2, z: 1, y: 4, halfX: 2, halfZ: 1, halfY: .1, navBlocker: true },
  { x: 1, z: -3, y: 5, halfX: 3, halfZ: 3, halfY: .1 },
];
for (const radius of [.35, .5, .65, 1.4]) test(`@E31-AC12 rectangular streamed nav bake equals clearance queries at radius ${radius}`, () => {
  for (const ground of [{ width: 25, depth: 17 }, { width: 25.23, depth: 17.37 }]) {
    const grid = new NavGrid(ground, walls, radius, { x: 2.17, z: -3.21 });
    const equal = () => { for (let cell = 0; cell < grid.blocked.length; cell++) expect(grid.blocked[cell], `cell ${cell}`).toBe(Number(!grid.clear(grid.x(cell), grid.z(cell), radius))); };
    equal(); grid.setBlocker(77, { x: 1, z: -3, y: 8, halfX: 2.2, halfZ: .02, halfY: .1 }, true); grid.rebake(); equal();
    grid.setBlocker(77, { x: 1, z: -3, y: 8, halfX: 2.2, halfZ: .02, halfY: .1 }, false); equal();
  }
});

test('@E31-AC12 streamed rectangle bucket traversal matches sampled exact wall sweeps', () => {
  let seed = 73; const random = () => { seed = Math.imul(seed, 1664525) + 1013904223 >>> 0; return seed / 4294967296; };
  const walls = Array.from({ length: 35 }, () => ({ x: random() * 60 - 30, z: random() * 60 - 30, y: 1, halfX: .02 + random() * 2, halfZ: .02 + random() * 2, halfY: 1 }));
  const direct = new NavGrid({ width: 80, depth: 80 }, walls), sampled = new NavGrid({ width: 80, depth: 80 }, walls, .65, { x: 0, z: 0 }, () => true);
  for (let i = 0; i < 3000; i++) {
    if (i % 100 === 0) for (const grid of [direct, sampled]) grid.setBlocker(88, { x: i % 9, z: i % 7, y: 3, halfX: .1, halfZ: 2, halfY: 1 }, i % 200 === 0);
    const from = { x: random() * 82 - 41, z: random() * 82 - 41 }, to = { x: random() * 82 - 41, z: random() * 82 - 41 };
    if (i % 3 === 0) to.x = from.x; if (i % 5 === 0) to.z = from.z;
    const r = [0, .1, .35, .65, 1.4][i % 5]; expect(direct.visible(from, to, r), JSON.stringify({ from, to, r })).toBe(sampled.visible(from, to, r));
  }
});


test('@E31-AC12 streamed nav recenter reuses bounded buffers and matches a fresh bake', () => {
  const grid = new NavGrid({ width: 25, depth: 17 }, walls), storage = grid.blocked;
  for (const center of [{ x: 10, z: -10 }, { x: -10, z: 10 }, { x: 0, z: 0 }]) {
    grid.recenter(center); const fresh = new NavGrid(grid.ground, walls, grid.clearance, center);
    expect(grid.blocked).toBe(storage); expect(grid.blocked).toEqual(fresh.blocked);
    const from = grid.nearestCell(center.x, center.z), to = grid.nearestCell(center.x + 5, center.z + 3), a: number[] = [], b: number[] = [];
    expect(grid.path(from, to, a, 2000)).toBe(fresh.path(from, to, b, 2000)); expect(a).toEqual(b);
  }
});
