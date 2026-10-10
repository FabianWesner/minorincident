import type { DistrictLayout, Placement, StaticCollider } from './districts/types';
import type { PropSnapshot } from '../sim/interact/PropSystem';
import { findClearSpot, obstaclesOf } from './placementClearance';
import { l2Station, l2TruckRoute } from '../data/l2';
import { inside } from './districts/validate';

/**
 * Campaign world-state continuity (PO 2026-10-08: "That building exploded in L1 but in L2 it's still unaffected"; PO rule
 * "all objects persist"). L2 starts a few hours after L1 in the same town (D-GROVE, specs/epic-20 section 1), so whatever
 * L1 destroyed or moved is still there as its aftermath.
 *
 * Two kinds of carryover:
 * - scripted canon: what the L1 story always does (the lab blast burns the Medical Annex, the residents of the outbreak
 *   house break out). Applied to every L2 world, also when L2 is started directly from the level select.
 * - player-caused: what only this player's L1 run did (pushed dumpsters, closed yard gates, shoved props, pedestrians who
 *   died, where the bicycle was left). Captured when L1 completes into the campaign save (`CampaignSave.world.L1`),
 *   deterministic (sim state only, stable order, rounded), and absent (canon only) when there is no L1 record.
 *
 * L3+ use other districts (compositions), so nothing of D-GROVE carries further yet; a later level that reloads D-GROVE
 * calls `applyL1Aftermath` the same way.
 */
export interface L1Aftermath {
  version: 1;
  /** Pushable props the run moved (PropSystem snapshot ids `D-GROVE/<placement id>`), final poses. */
  props: PropSnapshot;
  /** Dumpster toys (`dumpster-N` anchors) pushed into their passage (one-way in L1, so they stay there). */
  dumpsters: string[];
  /** Yard gates (`gate-N` anchors) left closed (they start open). */
  gatesClosed: string[];
  /** Pedestrians who died in L1 (killed, not turned), where they fell, with their look. At most `MAX_BODIES`. */
  bodies: { x: number; z: number; yaw: number; model: string; tint: string }[];
  /** Where the courier left the bicycle, or null (still at the start, or unknown). */
  bike: { x: number; z: number; yaw: number } | null;
}
export const MAX_BODIES = 12;
export const emptyAftermath = (): L1Aftermath => ({ version: 1, props: [], dumpsters: [], gatesClosed: [], bodies: [], bike: null });

/** The L1 scripted destructions and their L2 aftermath (the audit of specs/epic-19 section 3 beats; see the lane report). */
export const l1Canon = {
  /** Beat 5: the contained pressure blast in the Sunset Grove Medical Annex (windows blown, interior fire, smoke). */
  annex: {
    placement: 'bld.clinic-annex:822', decay: 'burned',
    /** Debris blown out over the forecourt: rubble heaps under the window and beside the doors (fixed, blocked nav cells).
     * They leave the door approach (x 65..67) and the gate open: L2 refuge door 47 and the L1 markers stay reachable. */
    rubble: [
      { id: 'carry-annex-rubble-1', x: 63.1, z: -12.12, yaw: 0, scale: .88, half: [1.4, .72] },
      { id: 'carry-annex-rubble-2', x: 68.5, z: -12.22, yaw: 2.6, scale: .62, half: [.85, .62] },
    ],
  },
  /** Beat 9: the residents of one house break out through its yard gate (refuge door 30, LevelOneOutbreak.houseDoor). */
  outbreakHouse: { door: 30, gate: { x: 5.05147, z: 26 }, house: 'bld.house-a:405', entry: { x: 5.01147, z: 22.33275 } },
} as const;

type Dressing = { id: string; assetId: string; x: number; z: number; yaw?: number; scale?: [number, number, number] };
/** Static aftermath dressing (canon). Decals lie flat on the paving; props keep their own collision. */
export const l1AftermathDressing: readonly Dressing[] = [
  // Annex forecourt: scorch fanning out of the doors and the blown window, glass on the paving.
  { id: 'carry-annex-scorch-1', assetId: 'decal.scorch', x: 65.1, z: -10.15, yaw: .2, scale: [1.6, 1, 1.0] },
  { id: 'carry-annex-scorch-2', assetId: 'decal.scorch', x: 67, z: -10, yaw: 1.4, scale: [1.2, 1, 1.0] },
  { id: 'carry-annex-glass-1', assetId: 'decay.broken-glass', x: 65.3, z: -12.0, yaw: .3, scale: [.55, .55, .55] },
  { id: 'carry-annex-glass-2', assetId: 'decay.broken-glass', x: 66.5, z: -12.4, yaw: 2.1, scale: [.5, .5, .5] },
  // Outbreak house: a smeared trail from the house through the yard gate to the pavement, dropped belongings.
  { id: 'carry-house-blood-1', assetId: 'decal.blood-trail', x: 5.05, z: 25.3, yaw: .1, scale: [.7, 1, .8] },
  { id: 'carry-house-blood-2', assetId: 'decal.blood-trail', x: 5.85, z: 26.8, yaw: -.3, scale: [.6, 1, 1.2] },
  { id: 'carry-house-blood-3', assetId: 'decal.blood-pool', x: 5.05, z: 24.9, yaw: 0, scale: [.7, 1, .7] },
  { id: 'carry-house-blood-4', assetId: 'decal.blood-splats', x: 6.7, z: 28.3, yaw: .7, scale: [1.1, 1, 1.1] },
  { id: 'carry-house-belongings', assetId: 'decay.dropped-belongings', x: 7, z: 27.3, yaw: .8 },
];

/** World AABB blocker for a placement without baked collision boxes (physics + navigation, `placementColliders` fallback). */
function blocker(id: string, x: number, z: number, halfX: number, halfZ: number, height: number): StaticCollider {
  return { id, aabb: { min: [x - halfX, 0, z - halfZ], max: [x + halfX, height, z + halfZ] }, minTier: 0, maxTier: 5 };
}
/** Top of the baked paving at a point (kerbed sidewalks are 0.13 m up): dressing sits on it, decals just above it. */
export function pavingAt(layout: DistrictLayout, x: number, z: number): number {
  return layout.surfaces.reduce((h, s) => s.height !== undefined && inside([x, z], s.polygon) ? Math.max(h, s.height) : h, 0);
}
function place(layout: DistrictLayout, d: Dressing): void {
  const decal = d.assetId.startsWith('decal.'), scale = d.scale ?? [1, 1, 1], ground = pavingAt(layout, d.x, d.z);
  const r = Math.max(scale[0], scale[2]) * .9;
  const placement: Placement = { id: d.id, assetId: d.assetId, position: [d.x, decal ? Math.max(.06, ground + .03) : ground, d.z], yaw: d.yaw ?? 0, scale, minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l2', visualAabb: { min: [d.x - r, 0, d.z - r], max: [d.x + r, 1.5, d.z + r] } };
  placeClear(layout, placement);
}

/** Carryover solids obey the same clearance rule as L2 dressing. */
function placeClear(layout: DistrictLayout, placement: Placement): void {
  if (!placement.assetId.startsWith('decal.')) {
    const spot = findClearSpot(layout, placement, obstaclesOf(layout, 1), { margin: .1, lawnOk: true });
    if (!spot) throw new Error(`Continuity: no clear spot for ${placement.id}`);
    const dx = spot[0] - placement.position[0], dz = spot[1] - placement.position[2];
    placement.position = [spot[0], pavingAt(layout, ...spot), spot[1]];
    placement.visualAabb.min[0] += dx; placement.visualAabb.max[0] += dx;
    placement.visualAabb.min[2] += dz; placement.visualAabb.max[2] += dz;
  }
  layout.placements.push(placement);
}

/**
 * Applies the L1 aftermath to a D-GROVE layout copy (mutates and returns it): the canon always, plus the player-caused
 * statics of `aftermath` (the bicycle). Dynamic carryover (props, toys, bodies) is applied by the sim (`SimWorld`).
 */
export function applyL1Aftermath(layout: DistrictLayout, aftermath: L1Aftermath | null): DistrictLayout {
  if (layout.district !== 'D-GROVE') return layout;
  const annex = layout.placements.find(p => p.id === l1Canon.annex.placement);
  if (!annex) throw new Error(`Continuity: missing ${l1Canon.annex.placement}`);
  // The burned twin keeps the base footprint and collision; an unpowered light group keeps its lights off.
  annex.decay = l1Canon.annex.decay; annex.lightGroup = 'carry-dark';
  for (const d of l1AftermathDressing) place(layout, d);
  for (const r of l1Canon.annex.rubble) {
    const placement: Placement = { id: r.id, assetId: 'decay.rubble-pile', collisionId: 'carry.annex-rubble', position: [r.x, pavingAt(layout, r.x, r.z), r.z], yaw: r.yaw, scale: [r.scale, r.scale, r.scale], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l2', visualAabb: { min: [r.x - r.half[0], 0, r.z - r.half[1]], max: [r.x + r.half[0], 1.4 * r.scale, r.z + r.half[1]] } };
    placeClear(layout, placement);
    layout.colliders.push(blocker(r.id, placement.position[0], placement.position[2], r.half[0], r.half[1], 1.4 * r.scale));
  }
  const bike = aftermath?.bike;
  if (bike && clearOfL2Script(bike)) placeClear(layout, { id: 'carry-bike', assetId: 'veh.courier-bike', position: [bike.x, pavingAt(layout, bike.x, bike.z), bike.z], yaw: bike.yaw, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: 'l2', visualAabb: { min: [bike.x - 1.4, 0, bike.z - 1.4], max: [bike.x + 1.4, 1.3, bike.z + 1.4] } } satisfies Placement);
  return layout;
}

/**
 * Player-caused statics must never land on an L2 set piece: the station bay and apron, the truck route, the market doors
 * and forecourt, the bridge checkpoint. Those spots are skipped (the object is "gone", e.g. towed or cleared by the crews).
 */
export function clearOfL2Script(p: { x: number; z: number }, margin = 3): boolean {
  const boxes: [number, number, number, number][] = [[l2Station.x - 9, l2Station.z - 7, l2Station.x + 9, l2Station.z + 7], [-60, -47, -42, -33], [68, 20, 90, 40]];
  if (boxes.some(([x0, z0, x1, z1]) => p.x >= x0 - margin && p.x <= x1 + margin && p.z >= z0 - margin && p.z <= z1 + margin)) return false;
  for (let i = 1; i < l2TruckRoute.length; i++) {
    const [ax, az] = l2TruckRoute[i - 1], [bx, bz] = l2TruckRoute[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(p.x - (ax + dx * t), p.z - (az + dz * t)) < margin) return false;
  }
  return true;
}

/** Audit sites for tests and captures: every carried-over spot in L2 with its source event; `stand` = a walkable spot in view. */
export const carryoverSites = [
  { id: 'annex', event: 'L1 beat 5: lab pressure blast in the Medical Annex', kind: 'scripted', at: { x: 65.5, z: -14.5 }, stand: { x: 66, z: -11.6 } },
  { id: 'annex-forecourt', event: 'L1 beat 5: debris blown over the forecourt', kind: 'scripted', at: { x: 64.5, z: -12.4 }, stand: { x: 65.2, z: -9.4 } },
  { id: 'outbreak-house', event: 'L1 beat 9: residents break out of the outbreak house', kind: 'scripted', at: { x: 5.05, z: 25 }, stand: { x: 5.4, z: 27.6 } },
] as const;
