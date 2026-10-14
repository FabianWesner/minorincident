import { metroIngressColliders } from '../L5/metro';
import { highwayColliders } from '../L3/highway';
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
/** L10 finale platform (`kit.dispersal-platform`, tools/blender/sslib/minigun_cure.py): the baked boxes stop at 1.65 m and miss the 3 m deck,
 * so nobody could climb the stair or stand on the deck. Authored in the asset frame instead: the deck top (3.08 m) and the 15 stair
 * treads (top 2.9 m down to 0.1 m, 0.28 m run, 1.3 m wide, +X end) are walkable supports, the four columns and the deck rails are solid. */
const platformDeck: Aabb = { min: [-4, 2.92, -2], max: [4, 3.08, 2] };
const platformTreads: Aabb[] = Array.from({ length: 15 }, (_, i) => ({ min: [4 + .28 * i, 0, -.65], max: [4 + .28 * (i + 1) + .02, 2.9 - .2 * i, .65] } as Aabb));
const platformSolids: Aabb[] = [
  ...[-3.6, 3.6].flatMap(x => [-1.8, 1.8].map(z => ({ min: [x - .15, 0, z - .15], max: [x + .15, 2.92, z + .15] } as Aabb))),
  { min: [-4.05, 3.08, -2.05], max: [4.05, 4.1, -1.95] }, { min: [-4.05, 3.08, 1.95], max: [4.05, 4.1, 2.05] }, { min: [-4.05, 3.08, -2.05], max: [-3.95, 4.1, 2.05] },
];
const dispersalPlatform = { boxes: platformSolids.concat(platformDeck, platformTreads), walkable: new Set<Aabb>([platformDeck, ...platformTreads]) };
export function placementColliders(placements: Placement[], fallback: StaticCollider[]): StaticCollider[] {
  const sources = staticCollision;
  const placementIds = new Set(placements.map(p => p.id));
  // District-authored solids (such as merged planters) have no asset placement.
  // Keep them while replacing only placement footprints with GLB geometry.
  const authored = fallback.filter(c => !placementIds.has(c.id));
  return authored.concat(placements.flatMap(p => {
    // Low flower strips reuse the hedge mesh, but never its walking obstacle
    // or a stale district footprint from an earlier export.
    if (p.assetId === 'kit.highway-onramp' && p.lightGroup === 'l3-highway') return highwayColliders(p);
    if (p.collisionId === 'l5.metro-ingress') return metroIngressColliders(p);
    if (p.assetId === 'prop.flower') return [];
    const platform = p.assetId === 'kit.dispersal-platform' && !p.collisionId;
    const shape = platform ? dispersalPlatform : sources[p.collisionId ?? p.assetId];
    if (!shape) return fallback.filter(c => c.id === p.id);
    const boxes = shape.boxes.concat(extraSupports[p.assetId] ?? []);
    return boxes.flatMap((box, index) => {
      if (p.assetId === 'kit.army-checkpoint' && p.boomOpen && box.min[1] > 1 && box.min[0] < -5.9 && box.max[0] > -6.1 && box.min[2] < -1 && box.max[2] > 1) return [];
      const aabb: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        const sx = x * p.scale[0], sz = z * p.scale[2];
        const point = [sx * Math.cos(p.yaw) + sz * Math.sin(p.yaw) + p.position[0], y * p.scale[1] + p.position[1], -sx * Math.sin(p.yaw) + sz * Math.cos(p.yaw) + p.position[2]];
        for (let axis = 0; axis < 3; axis++) { aabb.min[axis] = Math.min(aabb.min[axis], point[axis]); aabb.max[axis] = Math.max(aabb.max[axis], point[axis]); }
      }
      if(p.navBlocker) aabb.navBlocker = true;
      return [{ id: `${p.id}/geometry-${index}`, aabb, walkable: platform ? dispersalPlatform.walkable.has(box) : box.max[1] < .45 || extraSupports[p.assetId]?.includes(box), minTier: p.minTier, maxTier: p.maxTier }];
    });
  }));
}
