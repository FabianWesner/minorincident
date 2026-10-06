import { staticCollision } from '../../assets/staticCollision';
import type { Placement, StaticCollider, Aabb } from './types';

/** Same compound GLB boxes serve physics, navigation and the debug overlay.
 * Transform every component by the placement, rather than filling a building's
 * manifest footprint (which includes roofs/canopies and open forecourts). */
export function placementColliders(placements: Placement[], fallback: StaticCollider[]): StaticCollider[] {
  const sources = staticCollision;
  return placements.flatMap(p => {
    const shape = sources[p.assetId];
    if (!shape) return fallback.filter(c => c.id === p.id);
    return shape.boxes.map((box, index) => {
      const aabb: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        const sx = x * p.scale[0], sz = z * p.scale[2];
        const point = [sx * Math.cos(p.yaw) + sz * Math.sin(p.yaw) + p.position[0], y * p.scale[1] + p.position[1], -sx * Math.sin(p.yaw) + sz * Math.cos(p.yaw) + p.position[2]];
        for (let axis = 0; axis < 3; axis++) { aabb.min[axis] = Math.min(aabb.min[axis], point[axis]); aabb.max[axis] = Math.max(aabb.max[axis], point[axis]); }
      }
      return { id: `${p.id}/geometry-${index}`, aabb, walkable: box.max[1] < .45, minTier: p.minTier, maxTier: p.maxTier };
    });
  });
}
