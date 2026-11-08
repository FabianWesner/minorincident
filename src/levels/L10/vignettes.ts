import { worldAssets } from '../../assets/worldDefinitions';
import type { Placement, Point } from '../districts/types';
import { cure } from './district';

/** Authored environmental stories for the full L10 walk. Positions are derived from the route at load time,
 * so these render-only scenes follow the mission route without changing navigation, encounters or checkpoints. */
export const cureVignetteCatalogue = [
  { id: 'last-stand', story: 'A sandbag line failed from the far side.', pieces: ['prop.sandbag-pallet', 'decay.blown-sandbags', 'prop.crates', 'decay.dropped-belongings'] },
  { id: 'evacuation', story: 'A family left in a hurry and abandoned its supplies.', pieces: ['prop.crates', 'decay.dropped-belongings', 'prop.trash-bags'] },
  { id: 'field-camp', story: 'A camp was abandoned before the fire went cold.', pieces: ['prop.tent', 'prop.crates', 'prop.folding-chair', 'decay.dropped-belongings'] },
  { id: 'triage', story: 'A field triage point was overrun.', pieces: ['prop.cure-iso-tent', 'prop.cure-generator', 'prop.medical-cooler', 'prop.trash-bags'] },
  { id: 'quarantine', story: 'The quarantine line was breached from within.', pieces: ['prop.cure-quarantine-fence', 'prop.cure-iso-tent', 'decay.dropped-belongings', 'prop.traffic-cone'] },
  { id: 'military-stop', story: 'A military stop was abandoned under fire.', pieces: ['veh.military-truck', 'prop.sandbag-pallet', 'prop.traffic-cone', 'prop.crates'] },
  { id: 'crash', story: 'An evacuation transport was abandoned in the field.', pieces: ['prop.sandbag-pallet', 'prop.crates', 'decay.dropped-belongings', 'prop.traffic-cone'] },
  { id: 'home-refuge', story: 'Someone tried to hold a doorway against the outbreak.', pieces: ['prop.picket-fence', 'prop.folding-chair', 'decay.dropped-belongings'] },
] as const;

/** Wall text is placed at five distinct route points in every region; rendered as the existing wall-sign batch. */
export const cureWallMessages = [
  'HELP', 'NO ROOM', 'WE WENT NORTH', "DON'T DRINK THE WATER", 'SAM WAS HERE',
  'KEEP THE GATE CLOSED', 'THEY ARE IN THE FIELDS', 'WAIT FOR THE TRUCK', 'DO NOT OPEN', 'WE TRIED',
] as const;

const distance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = dx * dx + dz * dz;
  const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const routeDistance = (p: Point, routes: readonly (readonly Point[])[]) => Math.min(...routes.flatMap(r => r.slice(1).map((b, i) => distance(p, r[i], b))));

function make(id: string, assetId: string, x: number, z: number, yaw: number): Placement {
  const d = worldAssets[assetId]?.dimensions;
  if (!d) throw new Error(`Unregistered L10 vignette asset: ${assetId}`);
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw)), hx = (d.x * c + d.z * s) / 2, hz = (d.x * s + d.z * c) / 2;
  return { id, assetId, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 0, maxTier: 6, allowRoad: false,
    lightGroup: 'decor', decor: true,
    visualAabb: { min: [x - hx, 0, z - hz], max: [x + hx, d.y, z + hz] } };
}

/** Stable route-driven set dressing; every scene has a different arrangement and sits outside the walking corridor. */
export function cureVignettes(occupied: readonly Placement[]): Placement[] {
  const out: Placement[] = [], routes = [...cure.regions.map(r => r.route), ...cure.detours.map(r => r.route)];
  const anchors = Object.values(cure.anchors);
  const regions = cure.regions;
  const themed = (region: number, ordinal: number) => cureVignetteCatalogue[(region * 3 + ordinal * 5 + Math.floor(ordinal / 3)) % cureVignetteCatalogue.length];
  let carry = 12, routeOffset = 0, ordinal = 0;
  for (const [ri, region] of regions.entries()) {
    const segments = region.route.slice(1).map((b, i) => ({ a: region.route[i], b, d: Math.hypot(b[0] - region.route[i][0], b[1] - region.route[i][1]) }));
    const length = segments.reduce((sum, q) => sum + q.d, 0);
    const pose = (station: number) => {
      for (const q of segments) {
        if (station > q.d) { station -= q.d; continue; }
        const ux = (q.b[0] - q.a[0]) / q.d, uz = (q.b[1] - q.a[1]) / q.d;
        return { x: q.a[0] + ux * station, z: q.a[1] + uz * station, ux, uz };
      }
      return undefined;
    };
    // 43–49 m authored cadence leaves room for clearance retries while averaging close to 20 scenes/km.
    for (let station = carry, local = 0; station < length - 8; station += 43 + ((ordinal * 17 + ri * 11) % 7), local++, ordinal++) {
      if (ri === 6 && station > length - 60) continue; // Keep the console approach and finale arena clear.
      const q = pose(station); if (!q) continue;
      const story = themed(ri, local), yaw = -Math.atan2(q.uz, q.ux) + ((ordinal % 3) - 1) * .18;
      const clear = (p: Placement, local: readonly Placement[]) => {
        const corners: Point[] = [[p.visualAabb.min[0], p.visualAabb.min[2]], [p.visualAabb.min[0], p.visualAabb.max[2]], [p.visualAabb.max[0], p.visualAabb.min[2]], [p.visualAabb.max[0], p.visualAabb.max[2]]];
        return corners.every(c => routeDistance(c, routes) >= 5.4 && routeDistance(c, routes) <= 20)
          && anchors.every(a => Math.hypot(a[0] - p.position[0], a[1] - p.position[2]) >= 6)
          && [...occupied, ...out, ...local].every(other => {
            const a = p.visualAabb, b = other.visualAabb;
            return a.min[0] >= b.max[0] + .5 || a.max[0] <= b.min[0] - .5 || a.min[2] >= b.max[2] + .5 || a.max[2] <= b.min[2] - .5;
          });
      };
      let placed: Placement[] = [];
      const preferred = (ordinal + ri) % 2 ? -1 : 1;
      for (const side of [preferred, -preferred]) for (const lateral of [12, 13.5, 15, 16.5, 18]) {
        const x = q.x - q.uz * side * lateral, z = q.z + q.ux * side * lateral;
        const chosen = story.pieces.map((asset, i) => {
          const along = i === 0 ? 0 : (i % 2 ? 1 : -1) * (1.5 + Math.floor(i / 2)), outward = i ? (i % 2 ? .8 : -.8) : 0;
          return make(`l10-vignette-r${ri + 1}-${ordinal}-${i}`, asset,
            x + q.ux * along - q.uz * side * outward,
            z + q.uz * along + q.ux * side * outward, yaw + i * .37);
        });
        const candidate: Placement[] = [];
        for (const p of chosen) if (clear(p, candidate)) candidate.push(p);
        if (candidate.length > placed.length) placed = candidate;
        if (placed.length === story.pieces.length) break;
      }
      // Keep each authored vignette readable even when one secondary prop lands inside an existing kit footprint.
      if (placed.length) out.push(...placed);
    }
    carry = Math.max(0, 46 - (length - carry) % 46); routeOffset += length;
  }
  void routeOffset;
  return out;
}
