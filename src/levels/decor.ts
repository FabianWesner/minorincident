// look-l6-l9 (QA batch 27: "L6, L9 and L10 read well but are dark and sparse"): render-only storytelling dressing along the
// walked/driven routes of L6 (D-SUBWAY) and L9 (D-CROSSING), inside the ~±6 m the game camera frames around the courier.
// Every piece is `decor`: no collider, no pushable body, no nav footprint (DistrictWorld/placementColliders skip it), so the
// sim, its entity ids, routes, triggers and timings stay byte-identical. Pieces are low (belongings, glass, bags, crates,
// chairs) or stand against walls and off the lanes, so nothing a body walks through reads as a solid obstacle.
import { Rng } from '../core/Rng';
import { worldAssets } from '../assets/worldDefinitions';
import { crossing } from './L9/district';
import { l6, l6Doors } from '../data/l6';
import type { DistrictId, Placement, Point } from './districts/types';

type Spot = { asset: string; x: number; z: number; y?: number; yaw?: number; scale?: number };

const placement = (district: string, i: number, s: Spot): Placement => {
  const d = worldAssets[s.asset]; if (!d) throw new Error(`Unregistered decor asset ${s.asset}`);
  const k = s.scale ?? 1, yaw = s.yaw ?? 0, y = s.y ?? 0, c = Math.abs(Math.cos(yaw)), n = Math.abs(Math.sin(yaw));
  const hx = (c * d.dimensions.x + n * d.dimensions.z) * k / 2, hz = (n * d.dimensions.x + c * d.dimensions.z) * k / 2;
  return { id: `decor-${district}-${i}`, assetId: s.asset, position: [s.x, y, s.z], yaw, scale: [k, k, k], minTier: 0, maxTier: 6, allowRoad: true,
    lightGroup: 'decor', decor: true, visualAabb: { min: [s.x - hx, y, s.z - hz], max: [s.x + hx, y + d.dimensions.y * k, s.z + hz] } };
};

/** L6 tunnel walkway tops (build-layout: kit.metro-tunnel boxes 7/8), track bed top and the night street slab. */
const L6Y = { walk: .87, bed: .55, street: 3.9 };
/** Tunnel x positions kept clear: service gates (+ their crates), the alternating barriers, hatches and corridor mouths. */
const l6Blocked = (x: number, side: 1 | -1) => l6.gates.some(g => x > g - 5 && x < g + 2.5)
  || Array.from({ length: 9 }, (_, k) => 42 + k * 24).some(b => Math.abs(x - b) < 2.2)
  || l6Doors.slice(2).some(d => (d.z > 15 ? 1 : -1) === side && Math.abs(x - d.x) < 3.2)
  || [54, 126, 198].some(m => side < 0 && Math.abs(x - m) < 3.2) || [78, 174].some(m => side > 0 && Math.abs(x - m) < 3.2);

/** Abandoned tunnel camps on the north walkway (the side the game camera sees past the track): bedroll, luggage, chair, cooler,
 * lit by a storm lantern (NightAccents.subwayAccents). Clear of the gates, alternating piers and corridor mouths. */
export const l6Camps = [47, 61, 100, 120, 141, 168, 191, 205, 225, 238].filter(x => !l6Blocked(x - 1.5, 1) && !l6Blocked(x + 2.8, 1));

/** Belongings left on the retreat: low pieces along the wall half of each side walkway, camps, glass on the bed edge. */
function subwayDecor(): Spot[] {
  const out: Spot[] = [], rng = new Rng(624, 'look-l6-l9:tunnel');
  const wallPieces = ['decay.dropped-belongings', 'prop.trash-bags', 'prop.crates', 'decay.dropped-belongings', 'prop.broken-chair', 'prop.medical-cooler', 'prop.trash-bags', 'prop.carpet', 'prop.pallet'];
  for (let x = 33; x < 244; x += 2.2 + rng.next() * 1.8) for (const side of [-1, 1] as const) {
    const r = Array.from({ length: 6 }, () => rng.next());
    // The near (south) walkway sits behind the wall piers from the game camera: most pieces go to the visible north side.
    if (r[0] < (side < 0 ? .7 : .2)) continue;
    const px = x + (r[1] - .5) * 1.6;
    if (l6Blocked(px, side) || l6Camps.some(c => px > c - 3 && px < c + 4)) continue;
    const asset = wallPieces[Math.floor(r[2] * wallPieces.length)];
    // Against the wall: the walkway spans 11.5..13.2 (south) and 16.8..18.5 (north); the courier keeps to the lane between.
    const z = side < 0 ? 11.95 + r[3] * .3 : 18.05 - r[3] * .3;
    out.push({ asset, x: px, z, y: L6Y.walk, yaw: (side < 0 ? 0 : Math.PI) + (r[4] - .5) * .9, scale: asset === 'prop.carpet' ? 1.2 : 1 });
  }
  // A dropped bag or pallet at the edge of the track bed, never in the middle of the walked lane.
  for (let x = 38; x < 242; x += 11 + rng.next() * 8) {
    const side = rng.next() < .5 ? -1 : 1, k = rng.next(), o = rng.next(), yaw = rng.next() * 6.28;
    if (l6.gates.some(g => Math.abs(x - g) < 3)) continue;
    out.push({ asset: k < .6 ? 'decay.dropped-belongings' : 'prop.pallet', x, z: 15 + side * (1.8 + o * .3), y: L6Y.bed, yaw, scale: .85 });
  }
  for (const cx of l6Camps) out.push(
    { asset: 'prop.carpet', x: cx, z: 17.75, y: L6Y.walk, yaw: Math.PI / 2, scale: 1.3 },
    { asset: 'decay.dropped-belongings', x: cx + 1.5, z: 17.95, y: L6Y.walk, yaw: Math.PI + .3 },
    { asset: 'prop.folding-chair', x: cx - 1.4, z: 17.6, y: L6Y.walk, yaw: -.6 },
    { asset: 'prop.medical-cooler', x: cx + 2.6, z: 18.05, y: L6Y.walk, yaw: Math.PI });
  // The night street (258..288 x 0..30): the evacuation left its luggage, bags, carts and cones along the walk to the exit.
  out.push(
    { asset: 'decay.dropped-belongings', x: 263.5, z: 11.2, y: L6Y.street, yaw: .7 }, { asset: 'decay.dropped-belongings', x: 270.5, z: 19.8, y: L6Y.street, yaw: 2.2 },
    { asset: 'decay.dropped-belongings', x: 277.5, z: 11.6, y: L6Y.street, yaw: 4.4 },
    { asset: 'prop.trash-bags', x: 268.2, z: 10.4, y: L6Y.street, yaw: .3 }, { asset: 'prop.trash-bags', x: 282.5, z: 16.8, y: L6Y.street, yaw: 1.9 },
    { asset: 'prop.trash-bags', x: 273.5, z: 21.4, y: L6Y.street, yaw: 4.1 },
    { asset: 'prop.traffic-cone', x: 266.2, z: 19.4, y: L6Y.street }, { asset: 'prop.traffic-cone', x: 275.5, z: 9.6, y: L6Y.street, yaw: 1.2 },
    { asset: 'prop.traffic-cone', x: 280.8, z: 12.2, y: L6Y.street, yaw: .5 },
    { asset: 'prop.shopping-cart', x: 279.5, z: 18.5, y: L6Y.street, yaw: 2.4 }, { asset: 'prop.crates', x: 272.5, z: 9.8, y: L6Y.street, yaw: .9 },
    { asset: 'prop.broken-chair', x: 266.5, z: 12.6, y: L6Y.street, yaw: 1.4 }, { asset: 'prop.medical-cooler', x: 284.5, z: 13.2, y: L6Y.street, yaw: 2 });
  return out;
}

const segDistance = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
/** Distance past the nearest lane edge (negative inside a lane). */
const laneDistance = (p: Point) => Math.min(...crossing.routes.map(r => Math.min(...r.points.slice(1).map((b, i) => segDistance(p, r.points[i], b))) - r.width / 2));

/** The exodus left its road: every ~20 m a spill of luggage, bags, carts, chairs and cones over one shoulder and its lane edge
 * (inner pieces flat or low: the vehicles keep the lane centre), and every few spills a roadside camp (bedroll, chair, cooler). */
function crossingDecor(placements: readonly Placement[]): Spot[] {
  const out: Spot[] = [], boxes = placements.map(p => [p.visualAabb.min[0], p.visualAabb.min[2], p.visualAabb.max[0], p.visualAabb.max[2]] as const);
  // Footprint radius (half diagonal): pieces never overlap each other or a placed prop (Scene Lab static clipping gate).
  const radius = (asset: string) => Math.hypot(worldAssets[asset].dimensions.x, worldAssets[asset].dimensions.z) / 2 ;
  const free = (x: number, z: number, asset: string) => { const m = radius(asset) + .1; return boxes.every(b => x < b[0] - m || x > b[2] + m || z < b[1] - m || z > b[3] + m) && out.every(s => Math.hypot(s.x - x, s.z - z) > m + radius(s.asset)); };
  const forks: Point[] = [[-450, 0], [450, 0]], nearFork = (x: number, z: number) => forks.some(f => Math.hypot(x - f[0], z - f[1]) < 18);
  const road = crossing.routes.find(r => r.id === 'road')!;
  const shared = (a: Point, b: Point) => road.points.some(q => q[0] === a[0] && q[1] === a[1]) && road.points.some(q => q[0] === b[0] && q[1] === b[1]);
  const lanePieces = ['decay.dropped-belongings', 'prop.pallet', 'decay.dropped-belongings', 'prop.carpet', 'prop.pallet'];
  const shoulderPieces = ['prop.trash-bags', 'decay.dropped-belongings', 'prop.crates', 'prop.broken-chair', 'prop.shopping-cart', 'prop.traffic-cone', 'prop.trash-bags', 'prop.crates', 'decay.dropped-belongings', 'prop.folding-chair'];
  const camp = [['prop.carpet', 0, 1.1], ['prop.folding-chair', -1.3, 1.6], ['prop.trash-bags', 1.4, 1.9], ['prop.crates', 2.6, 1.2]] as const;
  for (const route of crossing.routes) {
    const hw = route.width / 2;
    for (const [i, b] of route.points.slice(1).entries()) {
      const a = route.points[i];
      if (route.id !== 'road' && shared(a, b)) continue;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d, rng = new Rng(931, `look-l6-l9:${route.id}:${i}`);
      let side = rng.next() < .5 ? -1 : 1;
      for (let s = 10 + rng.next() * 6, n = 0; s < d - 10; s += 16 + rng.next() * 8, n++) {
        // Every draw of a spill happens before any rejection, so a Scene Lab crop (fewer placements) keeps the same pieces in frame.
        const r = Array.from({ length: 40 }, () => rng.next());
        side = r[0] < .75 ? -side : side;
        const pieces = 4 + Math.floor(r[1] * 4), at = (t: number, o: number): Point => [a[0] + ux * t - uz * side * o, a[1] + uz * t + ux * side * o];
        for (let k = 0; k < pieces; k++) {
          // Offsets from the lane centre: lane edge hw-1.4..hw-.4 (flat/low, clear of a vehicle on the lane centre), shoulder hw+.3..hw+1.9.
          const onLane = r[2 + k * 4] < .4, o = onLane ? hw - .4 - r[3 + k * 4] * 1.0 : hw + .3 + r[3 + k * 4] * 1.6;
          const [x, z] = at(s + (r[4 + k * 4] - .5) * 7, o), list = onLane ? lanePieces : shoulderPieces, asset = list[Math.floor(r[5 + k * 4] * list.length)];
          if (nearFork(x, z) || x > 500 || !free(x, z, asset) || (!onLane && laneDistance([x, z]) < .25)) continue;
          out.push({ asset, x, z, yaw: -Math.atan2(uz, ux) + (r[5 + k * 4] - .5) * 7, scale: 1 });
        }
        if (n % 4 === 2) for (const [k, [asset, dt, dz]] of camp.entries()) {
          const [x, z] = at(s + 9 + dt, hw + 1.2 + dz);
          if (!nearFork(x, z) && x <= 500 && laneDistance([x, z]) > .25 && free(x, z, asset)) out.push({ asset, x, z, yaw: -Math.atan2(uz, ux) + r[36 + k] * 2 - 1 });
        }
      }
    }
  }
  return out;
}

const cache = new Map<string, Placement[]>();
/** Render-only decor of a district (empty for districts without a look-l6-l9 pass). Deterministic and cached per layout. */
export function districtDecor(district: DistrictId, placements: readonly Placement[]): Placement[] {
  if (district !== 'D-SUBWAY' && district !== 'D-CROSSING') return [];
  const key = `${district}:${placements.length}`, hit = cache.get(key); if (hit) return hit;
  const spots = district === 'D-SUBWAY' ? subwayDecor() : crossingDecor(placements);
  const list = spots.map((s, i) => placement(district, i, s));
  cache.set(key, list);
  return list;
}
