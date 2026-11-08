import { worldAssets } from '../../assets/worldDefinitions';
import { Rng } from '../../core/Rng';
import type { Placement, Point } from '../districts/types';
import { cureCrossingLines } from './crossingStories';

/** Worn service paving follows the actual southern crossing, including the last
 * 100 m to the dispersal platform. Heights stay below the existing road paint;
 * all details are visual and leave the mission's ground/collision unchanged. */
export type GroundBox = [number, number, number, [number, number, number]];
export const cureAprons = (() => {
  const paving: GroundBox[] = [], kerbs: GroundBox[] = [], puddles: GroundBox[] = [];
  const paths = [cureCrossingLines[5].line, [...cureCrossingLines[6].line, [3975, -27] as Point], cureCrossingLines[7].line];
  const rng = new Rng(1110, 'cure-service-aprons');
  for (const path of paths) for (let j = 1; j < path.length; j++) {
    const a = path[j - 1], b = path[j], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
    // Small axis-aligned poured panels retain unequal edges and visible seams.
    for (let s = 3; s < length; s += 6) {
      const x = a[0] + ux * s, z = a[1] + uz * s;
      for (const side of [-1, 0, 1]) {
        if (side && rng.next() < .18) continue;
        paving.push([x - uz * side * 4.8, .006, z + ux * side * 4.8, [5.7, .012, 4.55]]);
      }
      if (rng.next() < .35) {
        const side = rng.next() < .5 ? -1 : 1;
        kerbs.push([x - uz * side * 7.2, .035, z + ux * side * 7.2, [Math.abs(ux) > .7 ? 3.2 : .22, .07, Math.abs(ux) > .7 ? .22 : 3.2]]);
      }
      if (rng.next() < .2) puddles.push([x + (rng.next() - .5) * 4, .019, z + (rng.next() - .5) * 4, [1.1 + rng.next(), 1, .45 + rng.next() * .6]]);
    }
  }
  return { paving, kerbs, puddles };
})();

/** Low scattered supplies and work lights between the old scene clusters.
 * Tall generators stay outside the two measured approach lines; they are the
 * established physics-only dressing, without adding AI navigation walls. */
export function cureForecourtDecor(placements: readonly Placement[]): Placement[] {
  const out: Placement[] = [];
  const add = (assetId: string, x: number, z: number, light = false, solid = false) => {
    const d = worldAssets[assetId].dimensions;
    const aabb = { min: [x - d.x / 2, 0, z - d.z / 2] as [number, number, number], max: [x + d.x / 2, d.y, z + d.z / 2] as [number, number, number] };
    if ([...placements, ...out].some(p => aabb.min[0] < p.visualAabb.max[0] + .4 && aabb.max[0] > p.visualAabb.min[0] - .4 && aabb.min[2] < p.visualAabb.max[2] + .4 && aabb.max[2] > p.visualAabb.min[2] - .4)) return;
    out.push({ id: `decor-cure-apron-${out.length}`, assetId, position: [x, 0, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 6,
      allowRoad: false, lightGroup: 'decor', decor: true, ...(light ? { roadLife: true } : {}), ...(solid ? { decorSolid: true } : {}), visualAabb: aabb });
  };
  for (const path of [cureCrossingLines[5].line, [...cureCrossingLines[6].line, [3975, -27] as Point], cureCrossingLines[7].line]) {
    for (let j = 1; j < path.length; j++) {
      const a = path[j - 1], b = path[j], length = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / length, uz = (b[1] - a[1]) / length;
      for (let s = 9, n = 0; s < length; s += 18, n++) {
        const side = n % 2 ? -1 : 1, x = a[0] + ux * s - uz * side * 4, z = a[1] + uz * s + ux * side * 4;
        add('prop.crates', x, z, true);
        add(n % 2 ? 'decay.dropped-belongings' : 'prop.pallet', x + ux * 2.1, z + uz * 2.1);
      }
    }
  }
  for (const [x, z] of [[3780, -16], [3822, -59], [3870, -16], [3907, -59], [3936, -16]] as Point[]) add('prop.cure-generator', x, z, true, true);
  return out;
}
