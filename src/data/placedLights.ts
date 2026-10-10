import table from './lightAnchors.json' with { type: 'json' };
import manifest from '../assets/manifest.json' with { type: 'json' };
import { glbId, type LightAnchor } from './lights';
import { productionIds } from '../assets/productionIds';

const anchors = table as unknown as Record<string, LightAnchor[]>;
const glbs = new Map((manifest as { id: string; glb?: string }[]).map(asset => [asset.id, asset.glb]));
/** Authored anchors of a placement asset (aliases resolve to their production export). */
export function anchorsFor(assetId: string): LightAnchor[] {
  const glb = glbs.get(productionIds[assetId] ?? assetId);
  return glb ? anchors[glbId(glb)] ?? [] : [];
}
/** Asset-frame anchor → world, for a placement at `position` with yaw (three's rotation.y) and scale. */
export function placeAnchor(a: LightAnchor, position: readonly number[], yaw: number, scale: readonly number[] = [1, 1, 1]): { position: [number, number, number]; direction: [number, number, number] } {
  const c = Math.cos(yaw), s = Math.sin(yaw), [x, y, z] = [a.position[0] * scale[0], a.position[1] * scale[1], a.position[2] * scale[2]], [dx, dy, dz] = a.direction;
  return { position: [position[0] + x * c + z * s, position[1] + y, position[2] - x * s + z * c], direction: [dx * c + dz * s, dy, -dx * s + dz * c] };
}
/** Stable anchor identity, shared by simulation state and every streamed LOD. */
export const placedLightId = (district: string, origin: readonly number[], placement: string, anchor: string): string => `${district}@${origin.join(',')}/${placement}/${anchor}`;
export interface PlacedLight {
  id: string; placementId: string; assetId: string; group: string; anchor: LightAnchor;
  position: [number, number, number]; direction: [number, number, number]; ground: number; on: boolean;
}
/** Build the anchor registry once from the resolved layout, including lights without pools.
 * Parked vehicles use the vehicle owner's headlight/brake/beacon state instead. */
export function placedLights(world: import('../sim/world/DistrictWorld').DistrictWorld): PlacedLight[] {
  const lights: PlacedLight[] = [];
  for (const district of world.districts) {
    const removed = new Set(district.decay.removed), lit = new Set(district.decay.lights);
    for (const placement of district.decay.placements) {
      if (removed.has(placement.id) || placement.assetId.startsWith('veh.')) continue;
      for (const anchor of anchorsFor(placement.assetId)) lights.push({
        id: placedLightId(district.id, district.origin, placement.id, anchor.name), placementId: placement.id, assetId: placement.assetId,
        group: anchor.powerGroup === 'self' ? placement.lightGroup : anchor.powerGroup, anchor,
        ...placeAnchor(anchor, [placement.position[0] + district.origin[0], placement.position[1], placement.position[2] + district.origin[1]], placement.yaw, placement.scale),
        ground: placement.position[1], on: lit.has(placement.lightGroup),
      });
    }
  }
  return lights;
}
