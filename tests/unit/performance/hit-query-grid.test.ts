import { expect, test } from 'vitest';
import { HitQuery, type CoverWall } from '../../../src/sim/combat/HitQuery';
import { EntityStore } from '../../../src/sim/world/EntityStore';
import { SpatialHash } from '../../../src/sim/spatial/SpatialHash';

type Point = { x: number; z: number; y?: number };
// Original full wall scan and XYZ slab arithmetic, independent of the optimized index/cover.
function reference(walls: readonly CoverWall[], origin: Point, direction: Point, range: number, ignore?: number, padding = 0): number {
  let closest = range;
  for (const wall of walls) {
    if (wall.entityId !== undefined && wall.entityId === ignore) continue;
    let near = 0, far = range;
    for (const axis of ['x', 'y', 'z'] as const) {
      const half = axis === 'x' ? wall.halfX : axis === 'y' ? wall.halfY : wall.halfZ, d = direction[axis] ?? 0;
      const extent = half + (axis === 'y' ? 0 : padding), start = origin[axis] ?? .7;
      if (Math.abs(d) < 1e-12) { if (start < wall[axis] - extent || start > wall[axis] + extent) { far = -1; break; } }
      else { const a = (wall[axis] - extent - start) / d, b = (wall[axis] + extent - start) / d; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
    }
    if (far >= near && near < closest) closest = near;
  }
  return closest;
}

test('ray-cell traversal and unrolled slabs exactly match full scans, including corners, padding and moving walls', () => {
  let seed = 173;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const walls: CoverWall[] = Array.from({ length: 150 }, (_, i) => ({ x: random() * 256 - 128, z: random() * 256 - 128, y: random() * 4, halfX: random() * 8, halfZ: random() * 8, halfY: random() * 3, entityId: i }));
  // This lower-left corner is touched by a NW -> SE ray; neither diagonal cell owns it.
  walls.push({ x: 4, z: 4, y: .7, halfX: 4, halfZ: 4, halfY: 1 });
  const dynamic: CoverWall[] = [{ x: 0, z: 0, y: .7, halfX: 1, halfZ: 2, halfY: 1, entityId: 200 }];
  const query = new HitQuery(new EntityStore(), new SpatialHash(), walls, dynamic);
  const check = (origin: Point, direction: Point, range: number, ignore?: number, padding = 0) => expect(query.clearDistance(origin, direction, range, ignore, padding)).toBe(reference([...walls, ...dynamic], origin, direction, range, ignore, padding));
  for (const signX of [-1, 1]) for (const signZ of [-1, 1]) for (const offset of [-1e-10, 0, 1e-10]) check({ x: -8 * signX + offset, z: -8 * signZ }, { x: signX, z: signZ }, 16);
  for (const p of [{ x: 8, z: -32 }, { x: -8, z: 0 }, { x: 0, z: 0 }]) {
    check(p, { x: 0, z: 1 }, 64); check(p, { x: 1, z: 0 }, 64); check(p, { x: 0, z: 0 }, 0);
  }
  for (let i = 0; i < 5000; i++) {
    const angle = random() * Math.PI * 2, origin = { x: random() * 400 - 200, z: random() * 400 - 200, ...(i % 2 ? { y: random() * 5 } : {}) };
    const direction = { x: Math.cos(angle), z: Math.sin(angle), ...(i % 3 ? { y: random() * 2 - 1 } : {}) };
    if (i % 100 === 0) dynamic[0].x = random() * 100 - 50;
    if (i % 500 === 0) { walls[0].z += 1; query.invalidate(); }
    check(origin, direction, random() * 400, i % 11 === 0 ? i % 150 : undefined, i % 7 === 0 ? random() * 10 : 0);
  }
});
