import type { DistrictWorld } from './DistrictWorld';
import type { Point } from '../../levels/districts/types';
import { inside } from '../../levels/districts/validate';

export interface HeightStep { a: Point; b: Point; upper: number; lower: number; /** Unit vector toward the lower side. */ outward: Point; source: string }
/** Inspect authored support boundaries against the actual combined height field. Subdivide
 * so overlapping slabs/solids cannot hide a partial edge. Shallow stairs are excluded. */
export function heightSteps(world: DistrictWorld): HeightStep[] {
  const result: HeightStep[] = [], seen = new Set<string>();
  for (const d of world.districts) {
    const boundaries = d.layout.surfaces.flatMap((s, i) => (s.height ?? 0) > .3 ? [{ polygon: s.polygon, source: `${d.id}/surface-${i}` }] : []);
    for (const c of d.decay.colliders) if (c.walkable && c.aabb.max[1] > .3) {
      const { min, max } = c.aabb;
      boundaries.push({ source: `${d.id}/${c.id}`, polygon: [[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]], [min[0], min[2]]] });
    }
    for (const { polygon, source } of boundaries) for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 1e-6) continue;
      const nx = -dz / length, nz = dx / length, count = Math.ceil(length / .5);
      for (let j = 0; j < count; j++) {
        const x = a[0] + dx * (j + .5) / count, z = a[1] + dz * (j + .5) / count;
        const wx = x + d.origin[0], wz = z + d.origin[1];
        // Ignore height-field polygons wholly in authored non-walkable voids.
        // A district perimeter still counts when its upper side is walkable.
        const plusPoint: Point = [x + nx * .08, z + nz * .08], minusPoint: Point = [x - nx * .08, z - nz * .08];
        const plusWalkable = inside(plusPoint, d.layout.bounds) && !d.layout.walkable.excluded.some(p => inside(plusPoint, p));
        const minusWalkable = inside(minusPoint, d.layout.bounds) && !d.layout.walkable.excluded.some(p => inside(minusPoint, p));
        if (!plusWalkable && !minusWalkable) continue;
        const plus = world.pavingHeight(wx + nx * .08, wz + nz * .08), minus = world.pavingHeight(wx - nx * .08, wz - nz * .08);
        if (Math.abs(plus - minus) <= .30001) continue;
        // A step under a solid building is not an exposed walking edge.
        if (d.decay.colliders.some(c => !c.walkable && c.aabb.max[1] > Math.max(plus, minus) + .3 && x > c.aabb.min[0] && x < c.aabb.max[0] && z > c.aabb.min[2] && z < c.aabb.max[2])) continue;
        const p: Point = [a[0] + dx * j / count + d.origin[0], a[1] + dz * j / count + d.origin[1]];
        const q: Point = [a[0] + dx * (j + 1) / count + d.origin[0], a[1] + dz * (j + 1) / count + d.origin[1]];
        const key = [p.map(n => n.toFixed(3)).join(','), q.map(n => n.toFixed(3)).join(',')].sort().join(':');
        if (seen.has(key)) continue;
        seen.add(key); result.push({ a: p, b: q, upper: Math.max(plus, minus), lower: Math.min(plus, minus), outward: plus < minus ? [nx, nz] : [-nx, -nz], source });
      }
    }
  }
  return result;
}
