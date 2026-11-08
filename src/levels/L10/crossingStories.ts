import { worldAssets } from '../../assets/worldDefinitions';
import type { Placement, Point } from '../districts/types';
import { cure } from './district';
import { cureEncounters, cureEncounterSlots, cureMedkits } from './encounters';
import { Rng } from '../../core/Rng';

/**
 * r9-l10pace (vqa58 "minutes of empty dark grass on the overland walk and the corridor"): the checkpoint bearing is the
 * route most couriers walk (the objective marker points straight at the next checkpoint), but every story spot of the
 * road dressing sits beside the winding road 75–100 m away. These lines are the measured physical crossings
 * (tools/playtest route trace). Along them, every 30–40 m and alternating sides, one small scene tells what happened:
 * a car that left the road and still burns, an abandoned camp with its fire, an overrun military stop, a depot spill.
 *
 * Tall pieces are ordinary solids (static collider + nav footprint, so infected walk round them); small pieces are
 * render-only decor. Every footprint stays >= 7.5 m from the crossing line and >= 8 m from any road, detour or pursuit
 * shortcut centre line, 4 m from every encounter slot (both tiers), 8 m from medkits and anchors, 1 m from existing
 * placements, and out of the last 100 m before the console (the arena and its finale props).
 */
export const cureCrossingLines: { theme: Theme; line: Point[] }[] = [
  // R2: round the blocked residential street on its south side.
  { theme: 'fringe', line: [[774, 26], [918, 21], [932, 7], [936, -12], [1151, -10], [1163, -15], [1228, -10], [1256, 23]] },
  // R3: the depot crossing dips south of the blocked yard towards the service road.
  { theme: 'depot', line: [[1257, 24], [1499, 11], [1513, -5], [1514, -26], [1519, -28], [1707, -43], [1795, -42], [1849, 11], [1855, 25]] },
  // R4: south of the blocked checkpoint, then along the field north of the military road.
  { theme: 'military', line: [[1857, 24], [2031, 10], [2056, -2], [2118, -2], [2134, -15], [2142, -51], [2173, -48], [2260, -66], [2394, -61], [2469, -4]] },
  // R5: entry forecourt to the lab; lab exit across the lawn to the corridor checkpoint.
  { theme: 'campus', line: [[2474, -4], [2682, -24], [2689, -18], [2690, 20], [2706, 41]] },
  { theme: 'campus', line: [[2810, 45], [2910, 45], [2929, 30], [2932, -4]] },
  // R6: the destroyed corridor's southern forecourts, round the blocked road at x 3313, to the complex seam.
  { theme: 'corridor', line: [[2940, -4], [3296, -16], [3312, -29], [3315, -91], [3643, -98], [3666, -80], [3690, -30]] },
  // R7: the complex approach (north of the Mega's pursuit shortcut; nothing inside the last 100 m to the console).
  { theme: 'military', line: [[3698, -25], [3944, -28]] },
];
type Theme = 'fringe' | 'depot' | 'military' | 'campus' | 'corridor';

interface Piece { asset: string; along: number; out: number; yaw: number; decay?: string; solid: boolean; light?: 'camp' | 'wreckfire'; fire?: [number, number] }
type Story = (rng: Rng) => Piece[];
const pick = <T,>(rng: Rng, list: readonly T[]) => list[Math.floor(rng.next() * list.length)];
const cars = ['veh.sedan-red', 'veh.suv-dark', 'veh.pickup-red', 'veh.sedan-white', 'veh.police-sedan'];
/** A car left the road and still burns, its load spilled behind it. */
const wreck: Story = rng => [
  { asset: pick(rng, cars), along: 0, out: .8, yaw: (.5 + rng.next() * .7) * (rng.next() < .5 ? -1 : 1), decay: 'burned', solid: true, light: 'wreckfire' },
  { asset: 'decay.dropped-belongings', along: -4.2, out: -.4, yaw: rng.next() * 6.28, solid: false },
  { asset: 'prop.trash-bags', along: -6.6, out: .6, yaw: rng.next() * 6.28, solid: false },
];
/** The corridor's evacuation column: a burned-out bus, luggage thrown from its doors. */
const bus: Story = rng => [
  { asset: 'veh.evac-bus', along: 0, out: 1.8, yaw: (rng.next() - .5) * .7, decay: 'burned', solid: true, light: 'wreckfire' },
  { asset: 'decay.dropped-belongings', along: 6.2, out: -.4, yaw: rng.next() * 6.28, solid: false },
  { asset: 'decay.dropped-belongings', along: -5.8, out: -.2, yaw: rng.next() * 6.28, solid: false },
];
/** An abandoned camp: a tent and chairs round a fire someone left burning, a lantern on the supplies. */
const camp: Story = rng => [
  { asset: 'prop.tent', along: 0, out: 2.2, yaw: rng.next() * 6.28, solid: true },
  { asset: 'prop.crates', along: 3.8, out: 1.6, yaw: rng.next() * 6.28, solid: false, light: 'camp', fire: [-1.4, -1.6] },
  { asset: 'prop.folding-chair', along: 1.2, out: -.6, yaw: rng.next() * 6.28, solid: false },
  { asset: 'prop.folding-chair', along: 3.6, out: -1, yaw: rng.next() * 6.28, solid: false },
  { asset: 'decay.dropped-belongings', along: -2.8, out: -.2, yaw: rng.next() * 6.28, solid: false },
];
/** An overrun army stop: a stalled truck or tank behind blown sandbags, a fire beside the sandbag stack. */
const military: Story = rng => [
  { asset: rng.next() < .4 ? 'veh.tank' : 'veh.military-truck', along: 0, out: 2.4, yaw: (rng.next() - .5) * .9, decay: 'wrecked', solid: true },
  { asset: 'decay.blown-sandbags', along: .6, out: -.6, yaw: (rng.next() - .5) * .5, solid: false },
  { asset: 'prop.sandbag-pallet', along: -6.4, out: .8, yaw: rng.next() * 6.28, solid: true, light: 'camp', fire: [-1.6, 1.4] },
  { asset: 'decay.dropped-belongings', along: 5.6, out: -.4, yaw: rng.next() * 6.28, solid: false },
];
/** A depot spill: a container stack and burning drums, crates on a pallet. */
const depot: Story = rng => [
  { asset: 'prop.cure-container-stack', along: 0, out: 3.2, yaw: (rng.next() - .5) * .4, solid: true },
  { asset: 'prop.cure-drum-stack', along: 4.8, out: .4, yaw: rng.next() * 6.28, solid: true, light: 'camp', fire: [1.5, .6] },
  { asset: 'prop.pallet', along: -4.8, out: 0, yaw: rng.next() * 6.28, solid: false },
  { asset: 'prop.crates', along: -4.6, out: 0, yaw: rng.next() * 6.28, solid: false },
];
/** A quarantine post that fell: an iso tent, a generator with its work light, an ambulance left behind. */
const evac: Story = rng => [
  { asset: 'prop.cure-iso-tent', along: 0, out: 3.8, yaw: (rng.next() - .5) * .4, solid: true },
  { asset: 'prop.cure-generator', along: 5.6, out: .6, yaw: (rng.next() - .5) * .6, solid: true, light: 'camp', fire: [2, 1.6] },
  { asset: 'veh.ambulance', along: -7.8, out: 1.4, yaw: (rng.next() - .5) * .8, decay: rng.next() < .5 ? 'wrecked' : undefined, solid: true },
  { asset: 'decay.dropped-belongings', along: 3, out: -.6, yaw: rng.next() * 6.28, solid: false },
];
const themes: Record<Theme, [Story, number][]> = {
  fringe: [[camp, 2], [wreck, 2], [evac, 1]],
  depot: [[depot, 3], [wreck, 2], [camp, 1], [military, 1]],
  military: [[military, 3], [wreck, 2], [camp, 1], [evac, 1]],
  campus: [[evac, 2], [camp, 2], [wreck, 1]],
  corridor: [[bus, 1], [wreck, 2], [military, 2], [camp, 1]],
};

const seg = (p: Point, a: Point, b: Point) => {
  const dx = b[0] - a[0], dz = b[1] - a[1], d = dx * dx + dz * dz;
  const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / d)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const lineDistance = (p: Point, line: readonly Point[]) => Math.min(...line.slice(1).map((b, i) => seg(p, line[i], b)));

export function cureCrossingStories(placements: readonly Placement[]): Placement[] {
  const out: Placement[] = [];
  const roads: Point[][] = [...cure.regions.map(r => r.route), ...cure.detours.map(d => d.route),
    [cure.regions[5].route[1], cure.anchors['corridor-breach'], cure.anchors['r6-r7-seam'], cure.regions[6].route[5]]];
  const slots: Point[] = cureEncounters.filter(e => !e.assault).flatMap(e => (['high', 'low'] as const).flatMap(t => cureEncounterSlots(e, t).map(s => [s.x, s.z] as Point)));
  const stations: Point[] = cureEncounters.map(e => e.at);
  const anchors: Point[] = [...Object.values(cure.anchors), ...cureMedkits.map(m => m.at)];
  const consoleAt = cure.anchors['cure-console'];
  const make = (id: string, piece: Piece, x: number, z: number, yaw: number): Placement => {
    const { dimensions: d } = worldAssets[piece.asset], c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hx = (d.x * c + d.z * s) / 2, hz = (d.x * s + d.z * c) / 2;
    return { id, assetId: piece.asset, position: [x, 0, z], yaw, scale: [1, 1, 1], minTier: 0, maxTier: 6, allowRoad: false,
      lightGroup: 'decor', ...(piece.solid ? {} : { decor: true }), ...(piece.decay ? { decay: piece.decay } : {}),
      visualAabb: { min: [x - hx, 0, z - hz], max: [x + hx, d.y, z + hz] } };
  };
  const corners = (p: Placement): Point[] => { const { min: a, max: b } = p.visualAabb; return [[a[0], a[2]], [a[0], b[2]], [b[0], a[2]], [b[0], b[2]], [p.position[0], p.position[2]]]; };
  const fits = (p: Placement, line: readonly Point[], taken: readonly Placement[], own: readonly Placement[], keep: { slots: Point[]; anchors: Point[]; roads: Point[][] }) => {
    const pts = corners(p);
    if (pts.some(q => lineDistance(q, line) < 3.2 || keep.roads.some(r => lineDistance(q, r) < 8))) return false;
    if (Math.hypot(p.position[0] - consoleAt[0], p.position[2] - consoleAt[1]) < 100) return false;
    const { min: a, max: b } = p.visualAabb;
    const near = (q: Point, r: number) => q[0] > a[0] - r && q[0] < b[0] + r && q[1] > a[2] - r && q[1] < b[2] + r;
    if (keep.slots.some(q => near(q, 4)) || keep.anchors.some(q => near(q, 8))) return false;
    // Pieces of one scene may stand close together; foreign placements keep a 1 m gap.
    const apart = (q: Placement, m: number) => { const { min: c, max: d } = q.visualAabb; return a[0] >= d[0] + m || b[0] <= c[0] - m || a[2] >= d[2] + m || b[2] <= c[2] - m; };
    return taken.every(q => apart(q, 1)) && own.every(q => apart(q, .15));
  };
  for (const [li, { theme, line }] of cureCrossingLines.entries()) {
    const segments = line.slice(1).map((b, i) => ({ a: line[i], b, d: Math.hypot(b[0] - line[i][0], b[1] - line[i][1]) }));
    const length = segments.reduce((s, q) => s + q.d, 0);
    const pose = (s: number) => {
      for (const q of segments) { if (s > q.d) { s -= q.d; continue; } const ux = (q.b[0] - q.a[0]) / q.d, uz = (q.b[1] - q.a[1]) / q.d; return { x: q.a[0] + ux * s, z: q.a[1] + uz * s, ux, uz }; }
      const q = segments[segments.length - 1]; const ux = (q.b[0] - q.a[0]) / q.d, uz = (q.b[1] - q.a[1]) / q.d; return { x: q.b[0], z: q.b[1], ux, uz };
    };
    // Only placements within reach of this crossing can collide with its scenes (keeps the load-time search small).
    const nearby = placements.filter(q => lineDistance([q.position[0], q.position[2]], line) < 40);
    const keep = { slots: slots.filter(q => lineDistance(q, line) < 40), anchors: anchors.filter(q => lineDistance(q, line) < 40),
      // Road segments that come within 60 m of the crossing (sampled every 10 m along the road).
      roads: roads.flatMap(r => r.slice(1).map((b, i) => [r[i], b])).filter(([a, b]) => {
        const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 10);
        for (let k = 0; k <= n; k++) if (lineDistance([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n], line) < 60) return true;
        return false;
      }) };
    const stories = themes[theme], total = stories.reduce((s, [, w]) => s + w, 0);
    const spacing = new Rng(1108, `cure-crossing:${li}`);
    let previous: Story | null = null;
    for (let station = 14 + spacing.next() * 10, n = 0; station < length - 10; station += 30 + spacing.next() * 10, n++) {
      const style = new Rng(1108, `cure-crossing:${li}:${n}`);
      let roll = style.next() * total, story = stories[0][0];
      for (const [fn, w] of stories) { if ((roll -= w) < 0) { story = fn; break; } }
      // Never the same scene twice in a row.
      if (story === previous) story = stories[(stories.findIndex(([fn]) => fn === story) + 1) % stories.length][0];
      const pieces = story(style);
      const preferred = n % 2 ? -1 : 1;
      let placed = null as Placement[] | null;
      for (const lit of [true, false]) for (const side of [preferred, -preferred]) {
        for (const shift of [0, -3, 3, -6, 6, -9, 9]) for (const lateral of [6, 7, 8, 9.5]) {
          if (placed) break;
          const { x, z, ux, uz } = pose(station + shift), base = -Math.atan2(uz, ux);
          const nx = -uz * side, nz = ux * side;   // away from the line
          const list: Placement[] = [];
          let ok = true;
          for (const [k, piece] of pieces.entries()) {
            const lat = lateral + piece.out, px = x + ux * piece.along + nx * lat, pz = z + uz * piece.along + nz * lat;
            const p = make(`decor-cure-cross-${li}-${n}-${k}`, piece, px, pz, base + piece.yaw);
            if (!fits(p, line, nearby, list, keep)) { if (k === 0 || piece.light && lit) { ok = false; break; } continue; }
            const fx = x + ux * (piece.along + (piece.fire?.[0] ?? 0)) + nx * (lat + (piece.fire?.[1] ?? 0)), fz = z + uz * (piece.along + (piece.fire?.[0] ?? 0)) + nz * (lat + (piece.fire?.[1] ?? 0));
            // NightAccents.cureAccents only lights a fire > 8.5 m past a lane edge and 14 m from an encounter station.
            const fireOk = !(keep.roads.some(r => lineDistance([fx, fz], r) < 12) || stations.some(q => Math.hypot(q[0] - fx, q[1] - fz) < 14.5) || lineDistance([fx, fz], line) < 5);
            // First pass: every scene keeps its fire. A spot beside an encounter station may take the scene unlit.
            if (piece.light && !fireOk && lit) { ok = false; break; }
            if (piece.light && fireOk) { p.fieldLight = piece.light; if (piece.fire) p.fireAt = [+fx.toFixed(2), +fz.toFixed(2)]; }
            list.push(p);
          }
          if (ok) placed = list;
        }
        if (placed) break;
      }
      if (placed) { out.push(...placed); nearby.push(...placed); previous = story; }
    }
  }
  return out;
}
