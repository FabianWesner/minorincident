import { crossing } from '../levels/L9/district';
import type { Point } from '../levels/districts/types';

/**
 * L9 encounters. Mixed infected enter around the authored risk anchors and follow the APC's engine (`layouts/D-CROSSING/routes.json`),
 * so the road has 2 risk groups (plus roadside wanderers), the countryside 3 and the dry shortcut 6: the shortcut is shorter and has 3x the opportunities.
 * Every route also has an authored detour at least `avoidM` from each of its groups (infected sight is 14 m), so any
 * group can be driven around without contact. Groups are not a gate: ramming is optional and costs durability.
 */
export interface L9Group { id: string; route: string; at: Point; runners: number; alphas: number }
const perRoute: Record<string, { runners: number; alphaAt?: number[] }> = {
  road: { runners: 6 }, countryside: { runners: 6 }, 'dry-shortcut': { runners: 8, alphaAt: [2, 5] },
};
// The authored risk anchors cover the middle/end of each drive, after the
// approach can already exceed the 60 s visibility target at ordinary speed.
// Move the first existing group along each route's opening leg; this keeps
// counts/detours intact and streams it well outside the starting camera.
const openingEncounters: Record<string, Point> = {
  road: [-300, -330], countryside: [-250, 240], 'dry-shortcut': [-300, -22.5],
};
const riskGroups: readonly L9Group[] = crossing.routes.flatMap(r => r.risks.map((at, i) => {
  const alphas = perRoute[r.id].alphaAt?.includes(i) ? 1 : 0;
  // The acceptance count includes Alphas. Preserve eight bodies in every
  // shortcut pack while replacing one runner in the two Alpha formations.
  const runners = r.id === 'dry-shortcut' ? 8 - alphas : perRoute[r.id].runners;
  return { id: `${r.id}-${i + 1}`, route: r.id, at: i === 0 ? openingEncounters[r.id] ?? at : at, runners, alphas };
}));
// Fixed roadside wanderers fill the long asphalt interval between the two
// risk groups. They exist once, preserve their identities on revisits, and
// leave the authored detour open; driving contact remains optional.
// The gravel return leg slows at its bends; near-verge singles keep that
// final approach visible while remaining over 20 m from its detour trace.
export const l9Groups: readonly L9Group[] = [...riskGroups, ...([
  // Road singles cover the long diagonal entry and the straight asphalt
  // interval, keeping each moving camera window within the 60 s threat target.
  [-410, -132], [-170, -326], [10, -334], [125, -346], [410, -132], [-390, -198], [-370, -264],
] as Point[]).map((at, i) => ({ id: `road-wanderer-${i}`, route: 'road', at, runners: 1, alphas: 0 })),
  // Following the city objective across the open sightline is a valid drive,
  // 30 m north of the shortcut packs. Those bodies only grazed its camera.
  // Singles on the near verge keep this real-input route visibly threatened;
  // the authored z10 detour still clears every one by more than 20 m.
  ...([[380, 152], [410, 104]] as Point[])
    .map((at, i) => ({ id: `countryside-wanderer-${i}`, route: 'countryside', at, runners: 1, alphas: 0 })),
  ...([[-380, -18], [-180, -12], [0, -12], [180, -12], [380, -18]] as Point[])
    .map((at, i) => ({ id: `shortcut-wanderer-${i}`, route: 'dry-shortcut', at, runners: 1, alphas: 0 })),
];

export const l9Encounters = {
  /** Required clearance between a group's centre and its route's detour trace (sight 14 m + hull). */
  avoidM: 20,
  /** Members stand in a blob of this spacing and spread around the anchor. */
  spacing: 1.3, columns: 4,
  /** Authored fixture progress for the zero-HP tests (share of the route length driven). */
  fixtures: { earlyZero: .15, lateZero: .85 },
};

/** Shared by the native mission, the presentation and the real-input driver. */
export const l9Course = {
  railX: 380,
  repair: { x: 423, z: 18, radius: 8, ticks: 1200, durability: 300 },
  gate: { x: 440, z: 0, halfZ: 7, seconds: 60, announceX: 240, sideZ: 11 },
  evacuation: { x: 457, z: 0, radius: 11, defendTicks: 1800, truckX: 459, truckZ: -16 },
  bridge: { x: 482, z: 0, halfZ: 6, endX: 508 },
  ramps: [{ id: 'overpass', x: -65, z: -330 }, { id: 'ditch', x: 80, z: -30 }],
  tanker: { x: -25, z: -330 },
  fire: { x: -20, z: 240, closeTicks: 900 },
} as const;
