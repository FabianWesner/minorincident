import { crossing } from '../levels/L9/district';
import type { Point } from '../levels/districts/types';

/**
 * L9-E1 encounters. One infected group stands on every authored risk anchor of every route (`layouts/D-CROSSING/routes.json`),
 * so the road has 2 groups, the countryside 3 and the dry shortcut 6: the shortcut is shorter and has 3x the opportunities.
 * Every route also has an authored detour at least `avoidM` from each of its groups (infected sight is 14 m), so any
 * group can be driven around without contact. Groups are not a gate: ramming is optional and costs durability.
 */
export interface L9Group { id: string; route: string; at: Point; runners: number; alphas: number }
const perRoute: Record<string, { runners: number; alphaAt?: number[] }> = {
  road: { runners: 6 }, countryside: { runners: 6 }, 'dry-shortcut': { runners: 8, alphaAt: [2, 5] },
};
export const l9Groups: readonly L9Group[] = crossing.routes.flatMap(r => r.risks.map((at, i) => ({
  id: `${r.id}-${i + 1}`, route: r.id, at, runners: perRoute[r.id].runners, alphas: perRoute[r.id].alphaAt?.includes(i) ? 1 : 0,
})));
export const l9Encounters = {
  /** Required clearance between a group's centre and its route's detour trace (sight 14 m + hull). */
  avoidM: 20,
  /** Members stand in a blob of this spacing and spread around the anchor. */
  spacing: 1.3, columns: 4,
  /** Authored fixture progress for the zero-HP tests (share of the route length driven). */
  fixtures: { earlyZero: .15, lateZero: .85 },
};
