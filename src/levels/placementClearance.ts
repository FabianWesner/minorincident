import { staticCollision } from '../assets/staticCollision';
import { inside } from './districts/validate';
import type { DistrictLayout, Placement, Tier } from './districts/types';

/**
 * Footprint test shared by the level layout rules (L2 dressing, L3 additions) and the layout overlap gate. A footprint is the
 * set of the asset's baked static-collision boxes, oriented by the placement transform, so a rotated barricade is tested as
 * a rotated rectangle and not as its fat axis-aligned hull. Low paving (top below 45 cm: steps, kerbs, slabs) is walkable
 * and never counts as an obstacle.
 */
type Pt = readonly [number, number];
export interface Footprint { id: string; poly: Pt[]; y0: number; y1: number }
const WALKABLE_TOP = .45;

/** Placements whose collision boxes are ground-level or purely cosmetic never block anything. */
const exempt = (assetId: string) => assetId.startsWith('decal.') || assetId.startsWith('npc.') || assetId === 'prop.flower';

/** Bounding sizes (manifest dimensions) of dressing assets that bake no collision box. */
const dimensions = new Map<string, { x: number; y: number; z: number }>([['prop.pallet', { x: 1.011, y: .208, z: 1.2 }], ['prop.flower-box', { x: .562, y: .44, z: 1.264 }]]);
/**
 * Footprints of one placement; `margin` grows every box sideways (clearance for the candidate being placed). `low` keeps the
 * ground-level boxes too, as a piece being placed must not lie on a fence foot or a kerb-side planter either; assets without
 * baked boxes (pallet) fall back to their manifest dimensions.
 */
export function footprints(p: Placement, margin = 0, low = false): Footprint[] {
  const shape = exempt(p.assetId) ? undefined : staticCollision[p.collisionId ?? p.assetId];
  if (!shape) return [];
  const d = dimensions.get(p.assetId), boxes = !shape.boxes.length && low && d ? [{ min: [-d.x / 2, .18, -d.z / 2] as [number, number, number], max: [d.x / 2, .18 + d.y, d.z / 2] as [number, number, number] }] : shape.boxes;
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  // Steps, plinths and forecourt islands of a building (top above 25 cm) are not paving: nothing may stand through them.
  const solidLow = (b: { max: readonly number[] }) => p.assetId.startsWith('bld.') && b.max[1] >= .25;
  return boxes.filter(b => low || b.max[1] >= WALKABLE_TOP || solidLow(b)).map((b, i) => {
    const xs = [b.min[0] * p.scale[0] - margin, b.max[0] * p.scale[0] + margin], zs = [b.min[2] * p.scale[2] - margin, b.max[2] * p.scale[2] + margin];
    const poly = [[xs[0], zs[0]], [xs[1], zs[0]], [xs[1], zs[1]], [xs[0], zs[1]]].map(([x, z]): Pt => [x * c + z * s + p.position[0], -x * s + z * c + p.position[2]]);
    return { id: `${p.id}#${i}`, poly, y0: b.min[1] * p.scale[1] + p.position[1], y1: b.max[1] * p.scale[1] + p.position[1] };
  });
}

/** Separating-axis test of two convex polygons; touching edges do not count. */
function polysOverlap(a: readonly Pt[], b: readonly Pt[]): boolean {
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++) {
    const [x0, z0] = poly[i], [x1, z1] = poly[(i + 1) % poly.length], nx = z0 - z1, nz = x1 - x0;
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const [x, z] of a) { const d = x * nx + z * nz; aMin = Math.min(aMin, d); aMax = Math.max(aMax, d); }
    for (const [x, z] of b) { const d = x * nx + z * nz; bMin = Math.min(bMin, d); bMax = Math.max(bMax, d); }
    if (aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6) return false;
  }
  return true;
}
const bounds = (poly: readonly Pt[]) => ({ x0: Math.min(...poly.map(p => p[0])), x1: Math.max(...poly.map(p => p[0])), z0: Math.min(...poly.map(p => p[1])), z1: Math.max(...poly.map(p => p[1])) });
export const footprintsOverlap = (a: Footprint, b: Footprint): boolean => {
  if (a.y1 <= b.y0 || b.y1 <= a.y0) return false;
  const p = bounds(a.poly), q = bounds(b.poly);
  if (p.x1 <= q.x0 || q.x1 <= p.x0 || p.z1 <= q.z0 || q.z1 <= p.z0) return false;
  return polysOverlap(a.poly, b.poly);
};

/** Placement id of the first obstacle the candidate (grown by `margin`) cuts into, or undefined when it is clear. */
export function firstOverlap(candidate: Placement, obstacles: readonly Footprint[], margin = 0): string | undefined {
  const mine = footprints(candidate, margin, true);
  for (const o of obstacles) for (const m of mine) if (footprintsOverlap(m, o)) return o.id.split('#')[0];
  return undefined;
}

/** Everything in the layout that is solid enough to cut into: placement footprints plus authored colliders (merged planters). */
export function obstaclesOf(layout: DistrictLayout, tier: Tier, skip: ReadonlySet<string> = new Set()): Footprint[] {
  const placed = new Set(layout.placements.map(p => p.id)), live = (o: { minTier: Tier; maxTier: Tier }) => o.minTier <= tier && o.maxTier >= tier;
  const out = layout.placements.filter(p => !skip.has(p.id) && live(p)).flatMap(p => footprints(p));
  for (const c of layout.colliders) if (live(c) && !placed.has(c.id.split('/')[0]) && !skip.has(c.id) && !c.walkable && c.aabb.max[1] >= WALKABLE_TOP) {
    const { min, max } = c.aabb;
    out.push({ id: `${c.id}#0`, poly: [[min[0], min[2]], [max[0], min[2]], [max[0], max[2]], [min[0], max[2]]], y0: min[1], y1: max[1] });
  }
  return out;
}

/** Front gardens: the loose-prop and vehicle rules keep dressing out of them. */
export const inLawn = (layout: DistrictLayout, x: number, z: number): boolean => layout.lawns.some(l => x >= l.min[0] && x <= l.max[0] && z >= l.min[1] && z <= l.max[1]);

/**
 * Nearest clear spot for `p`, same yaw. Vehicles first slide along their own axis (a car pulled back until its bumper just
 * touches the post reads as parked against it, never driven through it), then everything spirals outwards. A spot must be
 * inside the district, outside every garden and clear of all `obstacles` by `margin`; `accept` adds level-specific rules.
 */
export function findClearSpot(layout: DistrictLayout, p: Placement, obstacles: readonly Footprint[], opts: { margin?: number; slide?: boolean; lawnOk?: boolean; accept?: (x: number, z: number) => boolean; maxRadius?: number } = {}): [number, number] | undefined {
  const margin = opts.margin ?? .1, [x0, , z0] = p.position;
  const at = (x: number, z: number): boolean => {
    if (!inside([x, z], layout.bounds) || (!opts.lawnOk && inLawn(layout, x, z)) || opts.accept?.(x, z) === false) return false;
    return firstOverlap({ ...p, position: [x, p.position[1], z] }, obstacles, margin) === undefined;
  };
  if (at(x0, z0)) return [x0, z0];
  if (opts.slide) for (let d = .1; d <= 4; d += .1) for (const k of [d, -d]) {
    const x = x0 + Math.cos(p.yaw) * k, z = z0 - Math.sin(p.yaw) * k;
    if (at(x, z)) return [x, z];
  }
  for (let r = .25; r <= (opts.maxRadius ?? 12); r += .25) for (let a = 0; a < 16; a++) {
    const x = x0 + r * Math.cos(a * Math.PI / 8), z = z0 + r * Math.sin(a * Math.PI / 8);
    if (at(x, z)) return [x, z];
  }
  return undefined;
}

/** Overlapping pairs between `added` placements and the rest of the layout (the layout overlap gate). */
export function addedOverlaps(layout: DistrictLayout, tier: Tier, added: (p: Placement) => boolean): { a: string; b: string; assetA: string; assetB: string }[] {
  const all = layout.placements.filter(p => p.minTier <= tier && p.maxTier >= tier), byId = new Map(all.map(p => [p.id, p] as const)), out: { a: string; b: string; assetA: string; assetB: string }[] = [];
  const foot = new Map(all.map(p => [p.id, footprints(p, 0, added(p))] as const));
  const mine = all.filter(p => added(p));
  for (const p of mine) for (const q of all) {
    if (q.id === p.id || (added(q) && q.id < p.id)) continue;
    if (foot.get(p.id)!.some(a => foot.get(q.id)!.some(b => footprintsOverlap(a, b)))) out.push({ a: p.id, b: q.id, assetA: p.assetId, assetB: byId.get(q.id)!.assetId });
  }
  return out;
}

/**
 * Nudges movable placements (vehicles and loose street furniture) that cut into another live placement to the nearest clear
 * spot; fixed geometry (buildings, fences, hedges, beds) never moves. Returns the ids it moved so callers can drop stale colliders.
 */
export function resolveOverlaps(layout: DistrictLayout, tier: Tier, movable: (p: Placement) => boolean, opts: { maxRadius?: number } = {}): string[] {
  const live = layout.placements.filter(p => p.minTier <= tier && p.maxTier >= tier), moved: string[] = [];
  for (const p of live) {
    if (!movable(p) || !footprints(p, 0, true).length) continue;
    const others = live.filter(q => q.id !== p.id).flatMap(q => footprints(q));
    if (firstOverlap(p, others) === undefined) continue;
    const spot = findClearSpot(layout, p, others, { slide: p.assetId.startsWith('veh.'), maxRadius: opts.maxRadius ?? 6 });
    if (!spot) continue;
    const [dx, dz] = [spot[0] - p.position[0], spot[1] - p.position[2]];
    p.position = [spot[0], p.position[1], spot[1]];
    p.visualAabb = { min: [p.visualAabb.min[0] + dx, p.visualAabb.min[1], p.visualAabb.min[2] + dz], max: [p.visualAabb.max[0] + dx, p.visualAabb.max[1], p.visualAabb.max[2] + dz] };
    moved.push(p.id);
  }
  return moved;
}
