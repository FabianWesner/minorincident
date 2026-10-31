// look-l6-l9 (QA batch 27: "L6, L9 and L10 read well but are dark and sparse"): render-only storytelling dressing along the
// walked route of L6 (D-SUBWAY), inside the ~±6 m the game camera frames around the courier.
// Every piece is `decor`: no collider, no pushable body, no nav footprint (DistrictWorld/placementColliders skip it), so the
// sim, its entity ids, routes, triggers and timings stay byte-identical. Pieces are low (belongings, glass, bags, crates,
// chairs) or stand against walls and off the lanes, so nothing a body walks through reads as a solid obstacle.
import { Rng } from '../core/Rng';
import { worldAssets } from '../assets/worldDefinitions';
import { l6, l6Doors } from '../data/l6';
import { cureRoadsideBelt } from './L10/roadsideBelt';
import type { DistrictId, Placement } from './districts/types';

type Spot = { id?: string; asset: string; x: number; z: number; y?: number; yaw?: number; scale?: number };

const placement = (district: string, i: number, s: Spot): Placement => {
  const d = worldAssets[s.asset]; if (!d) throw new Error(`Unregistered decor asset ${s.asset}`);
  const k = s.scale ?? 1, yaw = s.yaw ?? 0, y = s.y ?? 0, c = Math.abs(Math.cos(yaw)), n = Math.abs(Math.sin(yaw));
  const hx = (c * d.dimensions.x + n * d.dimensions.z) * k / 2, hz = (n * d.dimensions.x + c * d.dimensions.z) * k / 2;
  return { id: s.id ?? `decor-${district}-${i}`, assetId: s.asset, position: [s.x, y, s.z], yaw, scale: [k, k, k], minTier: 0, maxTier: 6, allowRoad: true,
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
    // Rolled sleeping bag: keep it low and compact beside the luggage.
    { asset: 'prop.carpet', x: cx, z: 17.75, y: L6Y.walk, yaw: Math.PI / 2, scale: .7 },
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
  // Exit apron: a last rest stop, abandoned road supplies, and luggage by the
  // burned cart. Existing small assets stay on the sides of the central walk.
  for (const [i, [asset, x, z, yaw, scale]] of ([
    ['prop.folding-chair', 260.2, 23, -.7, 1], ['prop.carpet', 258.9, 24.2, .3, .65],
    ['prop.medical-cooler', 261.5, 24.1, .8, .85],
    ['prop.crates', 272.1, 6.9, .2, 1], ['prop.pallet', 274.7, 6.2, -.4, 1],
    ['decay.dropped-belongings', 275.4, 8.2, 1.8, .7],
    ['prop.broken-chair', 284.4, 23.6, 1.2, .8], ['prop.pallet', 282.5, 24.4, .5, .8],
  ] as const).entries()) out.push({ id: `decor-l6-exit-${i}`, asset, x, z, yaw, scale, y: L6Y.street });
  return out;
}

const cache = new Map<string, Placement[]>();
/** Render-only decor of a district (empty for districts without a look-l6-l9 pass). Deterministic and cached per layout. */
export function districtDecor(district: DistrictId, placements: readonly Placement[]): Placement[] {
  // L9 roadside pieces were removed (orchestrator 10-29): without vehicle collision they were pass-through, with it the APC
  // stopped on luggage. L9 keeps its existing dressing.
  const l7 = district === 'D-FAIR' && placements.some(p => p.id.startsWith('l7-'));
  if (district !== 'D-SUBWAY' && district !== 'D-CURE' && !l7) return [];
  const key = `${district}:${placements.length}`, hit = cache.get(key); if (hit) return hit;
  if (district === 'D-CURE') {
    const list = cureRoadsideBelt(placements); cache.set(key, list); return list;
  }
  if (l7) {
    const themes = [
      ['prop.crates', 'decay.dropped-belongings', 'decay.broken-glass'], ['prop.sandbag-pallet', 'decay.broken-glass', 'decay.dropped-belongings'],
      ['prop.crates', 'prop.bench', 'decay.broken-glass'], ['prop.sandbag-pallet', 'decay.furniture-barricade', 'decay.dropped-belongings'],
    ];
    const list: Placement[] = [], occupied = placements.filter(p => p.minTier <= 6 && p.maxTier >= 6);
    const ground = (x: number) => Math.min(3.9, Math.max(0, Math.floor((x - 85) / 5) * 5 / 130 * 3.9));
    const blocked = (p: Placement) => {
      const a = p.visualAabb;
      return [...occupied, ...list].some(q => {
        const b = q.visualAabb;
        return !(a.min[0] >= b.max[0] + .5 || a.max[0] <= b.min[0] - .5 || a.min[2] >= b.max[2] + .5 || a.max[2] <= b.min[2] - .5);
      });
    };
    // Four varied refugee and military remnants fill the long Northgate approach
    // between its existing wrecks. Their full AABBs stay outside the 10 m road.
    for (const [i, x] of [233, 195, 157, 119].entries()) {
      const side = i % 2 ? -1 : 1, theme = themes[i];
      for (const [j, asset] of theme.entries()) {
        const debris = asset === 'decay.broken-glass';
        const px = x + (j ? (j === 1 ? 1 : -1) * (debris ? 3.3 : 2.4) : 0);
        const spot: Spot = { asset, x: px, z: 15 + side * (debris ? 6.4 : 6.8 + (j ? 2.3 : 0)), y: ground(px), yaw: i * .63 + j * .8, scale: j ? .82 : 1 };
        const p = placement('D-FAIR', list.length + i * 2, spot);
        // Keep the whole footprint on one terrace, including rotated bedrolls
        // and pallets: sampling only the centre can leave an edge over a riser.
        if (p.position[1] < 3.9) {
          const tile = 85 + Math.floor((px - 85) / 5) * 5;
          const half = (p.visualAabb.max[0] - p.visualAabb.min[0]) / 2;
          const dx = Math.max(tile + half + .03, Math.min(tile + 5 - half - .03, px)) - px;
          p.position[0] += dx; p.visualAabb.min[0] += dx; p.visualAabb.max[0] += dx;
        }
        p.id = `decor-l7-northgate-${i}-${j}`;
        if (j === 0) p.roadLife = true;
        if (!blocked(p)) list.push(p);
      }
    }
    cache.set(key, list); return list;
  }
  const spots = subwayDecor();
  const list = spots.map((s, i) => placement(district, i, s));
  cache.set(key, list);
  return list;
}
