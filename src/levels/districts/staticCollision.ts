import { metroIngressColliders } from '../L5/metro';
import { highwayColliders } from '../L3/highway';
import { staticCollision } from '../../assets/staticCollision';
import { worldAssets } from '../../assets/worldDefinitions';
import physicsAssets from '../../data/physicsAssets';
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
// Shelter camp's physics bake contains only the floor slab. Its four fabric
// walls remain solid to actors and navigation, leaving no invisible tent interior.
const shelterCampWalls: Aabb[] = [
  { min: [-2.8, .18, -2.8], max: [2.8, 1.05, -2.65] },
  { min: [-2.8, .18, 2.65], max: [2.8, 1.05, 2.8] },
  { min: [-2.8, .18, -2.65], max: [-2.65, 1.05, 2.65] },
  { min: [2.65, .18, -2.65], max: [2.8, 1.05, 2.65] },
];
// The zoo service mouth is a small building shell with a centered doorway on
// its +X face. Keep three sides and the lintel solid while preserving that door.
const zooTunnelMouth: Aabb[] = [
  { min: [-3.3, .18, -2.8], max: [3.3, 4.76, -2.65] },
  { min: [-3.3, .18, 2.65], max: [3.3, 4.76, 2.8] },
  { min: [-3.3, .18, -2.8], max: [-3.15, 4.76, 2.8] },
  { min: [3.15, .18, -2.8], max: [3.3, 4.76, -.95] },
  { min: [3.15, .18, .95], max: [3.3, 4.76, 2.8] },
  { min: [3.15, 2.25, -.95], max: [3.3, 4.76, .95] },
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
    // Render-only details remain non-solid. Anything the asset manifest marks
    // solid keeps the same baked collision and navigation footprint as an
    // authored placement, including streamed L10 vignette/set dressing.
    const shape = sources[p.collisionId ?? ''] ?? sources[p.assetId];
    if (p.decor && !p.decorSolid && !shape?.boxes.length && !worldAssets[p.assetId]?.world?.solid) return [];
    const platform = p.assetId === 'kit.dispersal-platform' && !p.collisionId;
    const collisionShape = platform ? dispersalPlatform : shape;
    const dimensions = worldAssets[p.assetId]?.dimensions;
    const boxes = collisionShape?.boxes ?? (p.assetId === 'kit.metro-track' || p.assetId === 'kit.shelter-camp' || p.assetId === 'int.metro-exit' ? physicsAssets[p.assetId]?.boxes as Aabb[] | undefined : p.assetId === 'kit.zoo-tunnel-mouth' ? zooTunnelMouth : p.decor && dimensions ? [{ min: [-dimensions.x / 2, .18, -dimensions.z / 2] as [number, number, number], max: [dimensions.x / 2, dimensions.y, dimensions.z / 2] as [number, number, number] }] : undefined);
    if (!boxes) return fallback.filter(c => c.id === p.id);
    // The body-height bake retains the bullet tank's saddles but misses its
    // raised vessels. Keep the GLB's authored solid barrel hulls as well, so
    // dodging cannot put the courier inside the tank during the Mega fight.
    const tankHulls = p.assetId === 'kit.dispersal-tank-bullet' && !p.collisionId ? physicsAssets[p.assetId].boxes as Aabb[] : [];
    const collisionBoxes = boxes.concat(extraSupports[p.assetId] ?? [], p.assetId === 'kit.shelter-camp' ? shelterCampWalls : [], tankHulls);
    return collisionBoxes.flatMap((box, index) => {
      // Keep the metro exit's perimeter solid while leaving the authored stair
      // and escalator runs clear for actors. These baked step hulls span the
      // walking lanes and prevent traversal despite the matching nav surface.
      if (p.assetId === 'int.metro-exit' && (index >= 1 && index <= 24 || index >= 27 && index <= 53)) return [];
      if (p.assetId === 'kit.army-checkpoint' && p.boomOpen && box.min[1] > 1 && box.min[0] < -5.9 && box.max[0] > -6.1 && box.min[2] < -1 && box.max[2] > 1) return [];
      const aabb: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [box.min[0], box.max[0]]) for (const y of [box.min[1], box.max[1]]) for (const z of [box.min[2], box.max[2]]) {
        const sx = x * p.scale[0], sz = z * p.scale[2];
        const point = [sx * Math.cos(p.yaw) + sz * Math.sin(p.yaw) + p.position[0], y * p.scale[1] + p.position[1], -sx * Math.sin(p.yaw) + sz * Math.cos(p.yaw) + p.position[2]];
        for (let axis = 0; axis < 3; axis++) { aabb.min[axis] = Math.min(aabb.min[axis], point[axis]); aabb.max[axis] = Math.max(aabb.max[axis], point[axis]); }
      }
      if (p.orientedFootprint && Math.abs(Math.sin(2 * p.yaw)) > 1e-6) aabb.navFootprint = {
        x: p.position[0] + (box.min[0] + box.max[0]) * p.scale[0] / 2 * Math.cos(p.yaw) + (box.min[2] + box.max[2]) * p.scale[2] / 2 * Math.sin(p.yaw),
        z: p.position[2] - (box.min[0] + box.max[0]) * p.scale[0] / 2 * Math.sin(p.yaw) + (box.min[2] + box.max[2]) * p.scale[2] / 2 * Math.cos(p.yaw),
        halfX: Math.abs(box.max[0] - box.min[0]) * Math.abs(p.scale[0]) / 2,
        halfZ: Math.abs(box.max[2] - box.min[2]) * Math.abs(p.scale[2]) / 2,
        yaw: p.yaw,
      };
      if(p.navBlocker) aabb.navBlocker = true;
      return [{ id: `${p.id}/geometry-${index}`, aabb, walkable: platform ? dispersalPlatform.walkable.has(box) : box.max[1] < .45 || extraSupports[p.assetId]?.includes(box), minTier: p.minTier, maxTier: p.maxTier }];
    });
  }));
}
