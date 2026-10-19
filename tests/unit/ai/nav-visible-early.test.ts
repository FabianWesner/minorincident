import { expect, test } from 'vitest';
import { NavGrid, type Wall } from '../../../src/sim/ai/NavGrid';

type Point = { x: number; z: number };
/** Independent exhaustive oracle: every wall, rather than crossed spatial buckets. */
function visible(nav: NavGrid, walls: Wall[], from: Point, to: Point, radius: number, mask?: (x: number, z: number) => boolean): boolean {
  if (!nav.clear(to.x, to.z, radius) || Math.abs(from.x) + radius >= 60 || Math.abs(from.z) + radius >= 60) return false;
  const dx = to.x - from.x, dz = to.z - from.z, steps = Math.ceil(Math.hypot(dx, dz) / .2);
  if (mask) for (let i = 0; i <= steps; i++) if (!mask(from.x + dx * i / Math.max(1, steps), from.z + dz * i / Math.max(1, steps))) return false;
  for (const wall of walls) {
    const x0 = wall.x - wall.halfX - radius, x1 = wall.x + wall.halfX + radius;
    const z0 = wall.z - wall.halfZ - radius, z1 = wall.z + wall.halfZ + radius;
    if (from.x > x0 && from.x < x1 && from.z > z0 && from.z < z1 &&
      ((from.x <= wall.x && to.x <= x0) || (from.x >= wall.x && to.x >= x1) || (from.z <= wall.z && to.z <= z0) || (from.z >= wall.z && to.z >= z1))) continue;
    let enter = 0, leave = 1;
    if (dx === 0) { if (from.x <= x0 || from.x >= x1) continue; }
    else { const a = (x0 - from.x) / dx, b = (x1 - from.x) / dx; enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b)); }
    if (dz === 0) { if (from.z <= z0 || from.z >= z1) continue; }
    else { const a = (z0 - from.z) / dz, b = (z1 - from.z) / dz; enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b)); }
    if (enter < leave) return false;
  }
  return true;
}

test('T-E22-20-nav @E22-AC20 early segment rejection preserves walls, masks, narrow corners and outward escapes', () => {
  const walls: Wall[] = Array.from({ length: 24 }, (_, i) => ({ x: i % 6 * 11 - 28, y: .5, z: Math.floor(i / 6) * 13 - 20, halfX: i % 3 ? 1.7 : .001, halfY: .5, halfZ: i % 4 + .2 }));
  const points = Array.from({ length: 60 }, (_, i) => ({ x: (i * 37 % 117) - 58, z: (i * 29 % 119) - 59 }));
  points.push({ x: -28, z: -20 }, { x: -28.35, z: -20 }, { x: -27.65, z: -20 }, { x: 60, z: 0 });
  for (const mask of [undefined, (x: number, z: number) => !(x > 3 && x < 8 && z > -9 && z < -4)]) {
    const nav = new NavGrid({ width: 120, depth: 120 }, walls, .65, { x: 0, z: 0 }, mask ?? null);
    for (const radius of [.05, .35, .8]) for (const from of points) for (const to of points) {
      expect(nav.visible(from, to, radius), JSON.stringify({ from, to, radius })).toBe(visible(nav, walls, from, to, radius, mask));
    }
    const door: Wall = { x: 0, y: 1, z: 0, halfX: .15, halfY: 1, halfZ: 4 };
    for (const closed of [true, false]) {
      nav.setBlocker(900, door, closed);
      for (const from of points.slice(0, 12)) for (const to of points.slice(0, 12)) {
        expect(nav.visible(from, to, .35)).toBe(visible(nav, closed ? [...walls, door] : walls, from, to, .35, mask));
      }
    }
  }
});
