import { staticCollision } from '../../assets/staticCollision';
import type { Placement, StaticCollider, Aabb } from './types';

/** Same compound GLB boxes serve physics, navigation and the debug overlay.
 * Transform every component by the placement, rather than filling a building's
 * manifest footprint (which includes roofs/canopies and open forecourts). */
/** Walkable surfaces the compound GLB boxes miss: the Fire Station 3 bay floor (model 'Interior floor', top 0.53 m, x -4.8..1.5, z -5.125..3.325)
 * lies above the 0.3 m apron slab, so without it the courier and firefighters stand 23 cm inside the visible floor. */
const extraSupports: Record<string, { min: [number, number, number]; max: [number, number, number] }[]> = {
  'bld.fire-station': [{ min: [-4.8, .37, -5.125], max: [1.5, .53, 3.325] }],
};
export function placementColliders(placements: Placement[], fallback: StaticCollider[]): StaticCollider[] {
  const sources = staticCollision;
  const placementIds = new Set(placements.map(p => p.id));
  // District-authored solids (such as merged planters) have no asset placement.
  // Keep them while replacing only placement footprints with GLB geometry.
  const authored = fallback.filter(c => !placementIds.has(c.id));
  return authored.concat(placements.flatMap(p => {
    // Low flower strips reuse the hedge mesh, but never its walking obstacle
    // or a stale district footprint from an earlier export.
    if (p.assetId === 'prop.flower') return [];
    const shape = sources[p.assetId];
    if (!shape) return fallback.filter(c => c.id === p.id);
    const boxes = shape.boxes.concat(extraSupports[p.assetId] ?? []);
    return boxes.map((box, index) => {
      const aabb: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        const sx = x * p.scale[0], sz = z * p.scale[2];
        const point = [sx * Math.cos(p.yaw) + sz * Math.sin(p.yaw) + p.position[0], y * p.scale[1] + p.position[1], -sx * Math.sin(p.yaw) + sz * Math.cos(p.yaw) + p.position[2]];
        for (let axis = 0; axis < 3; axis++) { aabb.min[axis] = Math.min(aabb.min[axis], point[axis]); aabb.max[axis] = Math.max(aabb.max[axis], point[axis]); }
      }
      return { id: `${p.id}/geometry-${index}`, aabb, walkable: box.max[1] < .45 || extraSupports[p.assetId]?.includes(box), minTier: p.minTier, maxTier: p.maxTier };
    });
  }));
}
