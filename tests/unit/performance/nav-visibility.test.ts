import { expect, test } from 'vitest';
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
  const legacy = legacyVisible.bind(nav as unknown as ThisParameterType<typeof legacyVisible>);
  for (let i = 0; i < 3000; i++) {
    if (i % 100 === 0) nav.setBlocker(99, { x: i % 9, y: 1, z: i % 7, halfX: .1, halfY: 1, halfZ: 2 }, i % 200 === 0);
    const from = { x: random() * 50 - 25, z: random() * 50 - 25 }, to = { x: random() * 50 - 25, z: random() * 50 - 25 };
    if (i % 3 === 0) to.x = from.x; if (i % 5 === 0) to.z = from.z;
    const radius = [0, .1, .35, .65, 1.2][i % 5];
    expect(nav.visible(from, to, radius), JSON.stringify({ from, to, radius })).toBe(legacy(from, to, radius));
  }
});
