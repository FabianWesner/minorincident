import baked from '../../assets/staticCollision.json';
import { worldAssets } from '../../assets/worldDefinitions';
import manifest from '../../assets/manifest.json';
import type { Placement, StaticCollider, Aabb } from './types';

/** Same compound GLB boxes serve physics, navigation and the debug overlay.
 * Transform every component by the placement, rather than filling a building's
 * manifest footprint (which includes roofs/canopies and open forecourts). */
export function placementColliders(placements: Placement[], fallback: StaticCollider[]): StaticCollider[] {
  const sources = baked as unknown as Record<string, { source: string; boxes: Aabb[] }>;
  return placements.flatMap(p => {
    const shape = sources[p.assetId];
    if (!shape) return fallback.filter(c => c.id === p.id);
    let fit = 1, turn = 0;
    if (p.assetId === 'bld.pharmacy') {
      const source = manifest.find(a => a.id === 'int.pharmacy-clinic')!.dimensions, target = worldAssets[p.assetId].dimensions;
      const straight = Math.min(1, target.x / source.x, target.z / source.z), turned = Math.min(1, target.x / source.z, target.z / source.x);
      fit = Math.max(straight, turned); turn = turned > straight ? Math.PI / 2 : 0;
    }
    return shape.boxes.map((box, index) => {
      const aabb: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        const sx = (x * Math.cos(turn) + z * Math.sin(turn)) * fit * p.scale[0], sz = (-x * Math.sin(turn) + z * Math.cos(turn)) * fit * p.scale[2];
        const point = [sx * Math.cos(p.yaw) + sz * Math.sin(p.yaw) + p.position[0], y * p.scale[1] + p.position[1], -sx * Math.sin(p.yaw) + sz * Math.cos(p.yaw) + p.position[2]];
        for (let axis = 0; axis < 3; axis++) { aabb.min[axis] = Math.min(aabb.min[axis], point[axis]); aabb.max[axis] = Math.max(aabb.max[axis], point[axis]); }
      }
      return { id: `${p.id}/geometry-${index}`, aabb, minTier: p.minTier, maxTier: p.maxTier };
    });
  });
}
