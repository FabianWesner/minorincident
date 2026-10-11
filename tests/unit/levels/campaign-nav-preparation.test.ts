import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { missionIds } from '../../../src/levels/missions';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { stateHash } from '../../../src/sim/world/stateHash';
import type { NavGrid } from '../../../src/sim/ai/NavGrid';
import { NavGrid as WorldNavGrid, type NavDistrict } from '../../../src/sim/world/NavGrid';
import type { Point, Aabb } from '../../../src/levels/districts/types';
import { inside } from '../../../src/levels/districts/validate';
import type { ScenarioDefinition } from '../../../src/levels/loader';

const mode = vi.hoisted(() => ({ previous: false }));
vi.mock('../../../src/sim/world/NavGrid', async importOriginal => {
  const module = await importOriginal<typeof import('../../../src/sim/world/NavGrid')>();
  return { ...module, bakeNav: (...args: Parameters<typeof module.bakeNav>) => mode.previous ? legacyBakeNav(...args) : module.bakeNav(...args) };
});
vi.mock('../../../src/sim/ai/InfectedSystem', async importOriginal => {
  const module = await importOriginal<typeof import('../../../src/sim/ai/InfectedSystem')>();
  return { ...module, InfectedSystem: class extends module.InfectedSystem {
    constructor(world: SimWorld, definition: ScenarioDefinition, mask: NavGrid['mask'] = null) {
      super(world, definition, mode.previous ? null : mask);
      // Original campaign construction installed this mask after the constructors
      // (which perform no navigation queries), then rebaked with live blockers.
      if (mode.previous && mask) { this.nav.mask = mask; this.nav.rebake(); }
    }
  } };
});

for (const id of missionIds) test(`${id}: one campaign navigation bake matches the previous mask/rebake path`, async () => {
  const run = async (previous: boolean) => {
    mode.previous = previous;
    const world = new SimWorld(); await world.init();
    try {
      const composition = compositions[id];
      world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
      const districts = world.districts!;
      for (const d of districts.districts) for (const surface of d.layout.surfaces) for (const p of surface.polygon) for (const delta of [-1e-9, 0, 1e-9]) {
        const x = p[0] + d.origin[0] + delta, z = p[1] + d.origin[1] - delta;
        let reference = districts.groundHeight(x, z);
        for (const district of districts.districts) for (const slab of district.layout.surfaces) if (slab.height !== undefined && inside([x - district.origin[0], z - district.origin[1]], slab.polygon)) reference = Math.max(reference, slab.height);
        expect(districts.pavingHeight(x, z), `${id}: paving ${x},${z}`).toBe(reference);
      }
      const nav = world.infected!.nav, player = world.entities.get(1)!.transform;
      const hash = stateHash(world.getState()), blocked = Buffer.from(nav.blocked);
      const target = nav.nearestCell(player.x, player.z);
      nav.flow(nav.x(target), nav.z(target), nav.blocked.length);
      return { hash, blocked, target, distance: Buffer.from(nav.distance.buffer) };
    } finally { world.dispose(); mode.previous = false; }
  };
  const actual = await run(false), previous = await run(true);
  expect(actual.hash).toBe(previous.hash); expect(actual.target).toBe(previous.target);
  expect(actual.blocked.equals(previous.blocked)).toBe(true);
  expect(actual.distance.equals(previous.distance)).toBe(true);
}, 120_000);

// Exact pre-optimization polygon decisions, independent of the new broad phase.
function legacyBakeNav(districts: NavDistrict[], seed: number, cellSize = 1): WorldNavGrid {
  const min: Point = [Infinity, Infinity],
    max: Point = [-Infinity, -Infinity];
  for (const d of districts)
    for (const p of d.layout.bounds)
      for (let a = 0; a < 2; a++) {
        min[a] = Math.min(min[a], p[a] + d.origin[a]);
        max[a] = Math.max(max[a], p[a] + d.origin[a]);
      }
  const nav = new WorldNavGrid(min, max, cellSize, seed);
  for (const d of districts) {
    const buckets = new Map<string, Aabb[]>();
    for (const a of d.colliders) for (let z = Math.floor((a.min[2] - .4) / 4); z <= Math.floor((a.max[2] + .4) / 4); z++) for (let x = Math.floor((a.min[0] - .4) / 4); x <= Math.floor((a.max[0] + .4) / 4); x++) {
      const key = `${x},${z}`, bucket = buckets.get(key) ?? []; bucket.push(a); buckets.set(key, bucket);
    }
    for (let z = 0; z < nav.height; z++)
      for (let x = 0; x < nav.width; x++) {
        const p: Point = [
          min[0] + (x + 0.5) * nav.cellSize - d.origin[0],
          min[1] + (z + 0.5) * nav.cellSize - d.origin[1],
        ];
        if (
          inside(p, d.layout.bounds) &&
          !d.layout.walkable.excluded.some((area) => inside(p, area)) &&
          ! (buckets.get(`${Math.floor(p[0] / 4)},${Math.floor(p[1] / 4)}`) ?? []).some(
            (a) =>
              p[0] >= a.min[0] - 0.4 &&
              p[0] <= a.max[0] + 0.4 &&
              p[1] >= a.min[2] - 0.4 &&
              p[1] <= a.max[2] + 0.4,
          )
        )
          nav.cells[z * nav.width + x] = 1;
      }
  }
  let hash = (2166136261 ^ seed) >>> 0;
  for (const cell of nav.cells) hash = Math.imul(hash ^ cell, 16777619) >>> 0;
  nav.hash = `${nav.width}x${nav.height}:${hash.toString(16).padStart(8, "0")}`;
  return nav;
}
