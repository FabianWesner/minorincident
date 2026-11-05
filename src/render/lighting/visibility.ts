import type { Aabb } from '../../levels/districts/types';

/** One immutable triangle fan per static light, built during layout assembly.
 * The light-field pass uses these vertices; no occlusion ray work occurs per frame.
 * A source's own pole/base is ignored. Ground/support slabs cannot block light. */
export function visibilityPolygon(source: { x: number; z: number }, reach: number, obstacles: readonly Aabb[]): [number, number][] {
  const segments = 64;
  const nearby = obstacles.filter(a => a.max[1] - a.min[1] > .3
    && !(source.x >= a.min[0] && source.x <= a.max[0] && source.z >= a.min[2] && source.z <= a.max[2])
    && source.x + reach >= a.min[0] && source.x - reach <= a.max[0] && source.z + reach >= a.min[2] && source.z - reach <= a.max[2]);
  const polygon: [number, number][] = [[source.x, source.z]];
  for (let ray = 0; ray <= segments; ray++) {
    const angle = ray / segments * Math.PI * 2, dx = Math.cos(angle), dz = Math.sin(angle);
    let distance = reach;
    for (const a of nearby) {
      let near = 0, far = distance;
      for (let axis = 0; axis < 2; axis++) {
        const origin = axis === 0 ? source.x : source.z, direction = axis === 0 ? dx : dz;
        const min = a.min[axis * 2], max = a.max[axis * 2];
        if (Math.abs(direction) < 1e-9) { if (origin < min || origin > max) { far = -1; break; } }
        else {
          const t1 = (min - origin) / direction, t2 = (max - origin) / direction;
          near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2));
        }
      }
      if (near <= far && far >= 0) distance = Math.min(distance, near);
    }
    polygon.push([source.x + dx * distance, source.z + dz * distance]);
  }
  return polygon;
}
