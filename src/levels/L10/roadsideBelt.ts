import { worldAssets } from '../../assets/worldDefinitions';
import type { Placement, Point } from '../districts/types';
import { cure } from './district';
import { Rng } from '../../core/Rng';

/** Ground lantern in the narrow gap between R3's existing container and drum stacks. */
export const cureBeltGroundLantern = [1740, .235, 62.45] as const;

/** Low, render-only evacuation supplies. The existing decor path keeps bodies/nav/encounters unchanged. */
export function cureRoadsideBelt(placements: readonly Placement[]): Placement[] {
  const out: Placement[] = [];
  const roads = [...cure.regions.map(r => r.route), ...cure.detours.map(r => r.route)];
  const distance = (p: Point, a: Point, b: Point) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], d = dx * dx + dz * dz;
    const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
  };
  const laneDistance = (x: number, z: number) => Math.min(...roads.flatMap(r => r.slice(1).map((b, i) => distance([x, z], r[i], b))));
  const make = (assetId: string, x: number, z: number, yaw: number, index: number): Placement => {
    const { dimensions: d } = worldAssets[assetId], c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hx = (d.x * c + d.z * s) / 2, hz = (d.x * s + d.z * c) / 2;
    return { id: `decor-cure-belt-${index}`, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1],
      minTier: 0, maxTier: 6, decor: true, allowRoad: false, lightGroup: 'decor',
      visualAabb: { min: [x - hx, 0, z - hz], max: [x + hx, d.y, z + hz] } };
  };
  const clear = (p: Placement) => {
    const { min: a, max: b } = p.visualAabb;
    // Entire footprint stays >= 3 m beyond every 3 m road edge, including detours and corners.
    if ([[a[0], a[2]], [a[0], b[2]], [b[0], a[2]], [b[0], b[2]]].some(([x, z]) => laneDistance(x, z) < 6 || laneDistance(x, z) > 13)) return false;
    if (p.position[0] > 2905) return false;
    return [...placements, ...out].every(q => {
      let { min: c, max: d } = q.visualAabb;
      // These low supplies fit below tree crowns; the authored solid is the 0.6 m trunk box.
      if (q.assetId === 'prop.tree' || q.assetId === 'prop.street-tree') {
        c = [q.position[0] - .3, 0, q.position[2] - .3]; d = [q.position[0] + .3, 2.2, q.position[2] + .3];
      }
      return a[0] >= d[0] + .3 || b[0] <= c[0] - .3 || a[2] >= d[2] + .3 || b[2] <= c[2] - .3;
    });
  };
  const themes = [
    ['prop.crates', 'decay.dropped-belongings', 'prop.traffic-cone'],
    ['prop.crates', 'prop.folding-chair', 'decay.dropped-belongings'],
    ['prop.crates', 'prop.pallet', 'prop.trash-bags'],
    ['prop.crates', 'prop.sandbag-pallet', 'decay.dropped-belongings'],
    ['prop.medical-cooler', 'prop.crates', 'decay.dropped-belongings'],
    ['prop.folding-chair', 'prop.traffic-cone', 'prop.trash-bags'],
    ['prop.sandbag-pallet', 'prop.medical-cooler', 'prop.traffic-cone'],
    ['prop.pallet', 'prop.folding-chair', 'decay.dropped-belongings'],
  ];
  let carry = 14, routeOffset = 0, previous = -Infinity, ordinal = 0;
  const spacing = new Rng(248, 'cure-roadside-spacing');
  for (const [ri, region] of cure.regions.slice(0, 5).entries()) {
    const segments = region.route.slice(1).map((b, i) => ({ a: region.route[i], b, d: Math.hypot(b[0] - region.route[i][0], b[1] - region.route[i][1]) }));
    const length = segments.reduce((s, q) => s + q.d, 0);
    const pose = (s: number) => {
      for (const q of segments) {
        if (s > q.d) { s -= q.d; continue; }
        const ux = (q.b[0] - q.a[0]) / q.d, uz = (q.b[1] - q.a[1]) / q.d;
        return { x: q.a[0] + ux * s, z: q.a[1] + uz * s, ux, uz };
      }
      throw new Error('Roadside belt station beyond region');
    };
    let station = carry;
    for (let n = 0; station < length; station += 25 + spacing.next() * 9, n++) {
      const style = new Rng(248, `cure-roadside:${ri}:${n}`);
      const theme = themes[(ri * 3 + n * 5) % themes.length];
      const companions = style.next() < .25 ? [] : theme.slice(1, style.next() < .4 ? 2 : 3);
      let side = ordinal++ % 2 ? -1 : 1;
      let anchor: Placement | undefined, forward: Point = [1, 0];
      // At inside switchback corners the other road occupies the preferred verge. Use the
      // outside verge there; straight stretches retain the alternating left/right rhythm.
      for (const candidateSide of [side, -side]) {
        for (const shift of [0, -1.5, 1.5, -3, 3, -6, 5.5, 6]) {
          if (station + shift < 1 || station + shift > length - 1 || routeOffset + station + shift - previous < 25) continue;
          const { x, z, ux, uz } = pose(station + shift);
          for (const lateral of [7, 7.8, 8.6, 9.4, 10.2, 11, 11.8, 12.5]) {
            for (const asset of [theme[0], 'prop.medical-cooler']) {
              const p = make(asset, x - uz * candidateSide * lateral, z + ux * candidateSide * lateral, -Math.atan2(uz, ux), out.length);
              if (!clear(p) || laneDistance(p.position[0], p.position[2]) < 7) continue;
              p.id = `decor-cure-belt-r${ri + 1}-${n}-lamp`;
              p.roadLife = true; out.push(p); anchor = p; forward = [ux, uz]; side = candidateSide; previous = routeOffset + station + shift; break;
            }
            if (anchor) break;
          }
          if (anchor) break;
        }
        if (anchor) break;
      }
      if (!anchor) continue;
      const [x, , z] = anchor.position, [ux, uz] = forward;
      for (const [j, asset] of companions.entries()) {
        for (const [along, outward] of [[j ? -1.8 : 1.8, .2], [j ? -2.4 : 2.4, 1.2], [j ? -3 : 3, -.3]]) {
          const p = make(asset, x + ux * along - uz * side * outward, z + uz * along + ux * side * outward, anchor.yaw + (j ? .4 : -.35), out.length);
          if (laneDistance(p.position[0], p.position[2]) > 13 || !clear(p)) continue;
          p.id = `decor-cure-belt-r${ri + 1}-${n}-${j}`; out.push(p); break;
        }
      }
    }
    carry = station - length; routeOffset += length;
  }
  return out;
}
