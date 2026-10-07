import table from '../data/lightAnchors.json';
import manifest from '../assets/manifest.json';
import { glbId, type LightAnchor } from '../data/lights';
import { productionIds } from '../assets/productionIds';
import { footprint, type FieldLight } from './LightField';
import type { DistrictWorld } from '../sim/world/DistrictWorld';

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
/** Every light anchor of the loaded layouts as a light-field footprint, built once at level assembly.
 * A light is on while its placement's power group is lit at this decay tier. Parked vehicles stay dark. */
export function layoutLights(world: DistrictWorld): FieldLight[] {
  const lights: FieldLight[] = [];
  for (const d of world.districts) {
    const removed = new Set(d.decay.removed), lit = new Set(d.decay.lights);
    for (const p of d.decay.placements) {
      if (removed.has(p.id) || p.assetId.startsWith('veh.')) continue;
      for (const a of anchorsFor(p.assetId)) {
        if (!a.pool) continue;
        const placed = placeAnchor(a, [p.position[0] + d.origin[0], p.position[1], p.position[2] + d.origin[1]], p.yaw, p.scale);
        const light = footprint({ ...a, ...placed }, p.position[1], lights.length * 1.37);
        light.on = lit.has(p.lightGroup); lights.push(light);
      }
    }
  }
  // Decay fires (W3+) flicker in the field; E27 adds its own through LightField.addTransient.
  for (const f of world.fires) lights.push(footprint({ type: 'fire', color: 'light_fire', intensity: 7, range: 4 + f.radius * 2, flicker: 'fire', position: [f.x, 1.2, f.z], direction: [0, -1, 0] }, 0, lights.length * 1.37));
  return lights;
}
