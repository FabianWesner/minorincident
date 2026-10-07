import type { Rng } from '../../core/Rng';
import type { InfectedSpeedTier } from '../../data/infected';
import { l1v2 } from '../../data/l1v2';

export type L1Mode = 'wander' | 'chase' | 'search' | 'attracted' | 'bite';
/**
 * Search episode (specs/epic-19 section 5.3): go to the origin (last-known position or the alarm car), then visit 3-6
 * probe points 4-12 m around it, biased toward the target's last heading and toward cover edges, pausing to look around
 * at each, with an optional double-back to an earlier probe. Plain data: snapshots and replays copy it as is.
 */
export interface SearchPlan {
  startTick: number;
  until: number;
  originX: number; originZ: number;
  /** Interleaved x, z of the probe route (double-back points included). */
  probes: number[];
  /** Index of the probe route point the double-back revisits, -1 when this episode has none. */
  doubleBackAt: number;
  /** -1 while approaching the origin, else the route index being walked to. */
  next: number;
  /** Distinct probe points reached (double-back revisits do not count). */
  visited: number;
  doubledBack: boolean;
  legTicks: number;
}
/** Per-infected L1 brain; `mode`, `looking`, `lookYaw` and `search` are the animation surface for lane G. */
export interface L1Brain {
  mode: L1Mode;
  /** E20: a wandering group member drifts back toward its home once farther than this (0 / absent = free wander). */
  leashM?: number;
  tier: InfectedSpeedTier;
  /** Chase speed: tier base x individual jitter, fixed for life (section 5.4). */
  runSpeed: number;
  wanderSpeed: number;
  targetId: number;
  /** Last seen position and heading (unit, 0 when unknown) of the chased human. */
  seenX: number; seenZ: number; seenTick: number; headingX: number; headingZ: number;
  /** Standing still and turning to look around (pause or search sweep), toward `lookYaw`. */
  looking: boolean;
  lookYaw: number;
  pauseUntil: number;
  goalX: number; goalZ: number; hasGoal: boolean;
  search: SearchPlan;
  /** Search episodes so far, for logs and tests. */
  episodes: number;
  distractionId: number;
  biteTargetId: number;
  /** Steering cache: the goal was in clear straight view at `directTick` (goal position directX/Z). */
  direct: boolean; directTick: number; directX: number; directZ: number;
  /** Where it spawned (or rose): wander drifts away from here. */
  homeX: number; homeZ: number;
  /** Herd cue: turning toward a seen attacker's heading until `cueUntil` (0 = none), from infected `cueSource`. */
  cueUntil: number; cueYaw: number; cueSource: number;
  /** Stuck watch: position at `stuckTick`; consecutive 0.75 s windows without progress while trying to move. */
  stuckX: number; stuckZ: number; stuckTick: number; stuckCount: number;
  /** A human given up as unreachable (fenced yard, no route) is ignored until `ignoreUntil`. */
  ignoreId: number; ignoreUntil: number;
}
export function searchPlan(): SearchPlan {
  return { startTick: 0, until: 0, originX: 0, originZ: 0, probes: [], doubleBackAt: -1, next: -1, visited: 0, doubledBack: false, legTicks: 0 };
}
/** Walkability and cover tests the planner needs from the navigation grid. */
export interface ProbeTerrain { clear(x: number, z: number, radius?: number): boolean }
const coverProbeM = 1.7, agentRadius = 0.45;
function coverEdge(nav: ProbeTerrain, x: number, z: number): boolean { return !nav.clear(x, z, coverProbeM); }
/**
 * Plans one search episode in place. `durationTicks` is drawn by the caller (uniform 10-18 s); the first probes keep
 * short legs so even a 10 s episode inspects at least three places.
 */
export function planSearch(plan: SearchPlan, rng: Rng, nav: ProbeTerrain, tick: number, origin: { x: number; z: number }, heading: { x: number; z: number }, durationTicks: number, radius: readonly [number, number] = l1v2.infected.search.probeRadiusM): void {
  const tuning = l1v2.infected.search;
  plan.startTick = tick; plan.until = tick + durationTicks; plan.originX = origin.x; plan.originZ = origin.z;
  plan.probes.length = 0; plan.doubleBackAt = -1; plan.next = -1; plan.visited = 0; plan.doubledBack = false; plan.legTicks = 0;
  const count = tuning.probePoints[0] + Math.floor(rng.next() * (tuning.probePoints[1] - tuning.probePoints[0] + 1));
  const known = heading.x !== 0 || heading.z !== 0, base = known ? Math.atan2(heading.z, heading.x) : rng.next() * Math.PI * 2;
  let px = origin.x, pz = origin.z, side = rng.next() < 0.5 ? 1 : -1, previous = base;
  for (let i = 0; i < count; i++) {
    // The first probe lies ahead of the target's heading; each next one sweeps on around the origin (<= ~90 deg from the
    // previous one), so legs never cut back through the last-known position.
    const spread = i === 0 ? 0.8 : i < 3 ? 1.1 : 1.6, near = i < 3 ? Math.min(radius[1], radius[0] + 3.5) : radius[1];
    let bestScore = -Infinity, bx = 0, bz = 0, ba = 0;
    for (let k = 0; k < 10; k++) {
      const angle = previous + side * rng.next() * spread * (k % 2 ? -1 : 1), r = radius[0] + rng.next() * (near - radius[0]);
      const x = origin.x + Math.cos(angle) * r, z = origin.z + Math.sin(angle) * r;
      if (!nav.clear(x, z, agentRadius)) continue;
      const leg = Math.hypot(x - px, z - pz);
      if (leg < 2.5) continue;
      const score = Math.cos(angle - base) * (known ? 0.7 : 0) + (coverEdge(nav, x, z) ? 0.8 : 0) - Math.max(0, leg - 7) * 0.35 + rng.next();
      if (score > bestScore) { bestScore = score; bx = x; bz = z; ba = angle; }
    }
    if (bestScore === -Infinity) continue;
    plan.probes.push(bx, bz); px = bx; pz = bz; previous = ba; side = -side;
  }
  // Double back: after the third probe, return to (near) the second before moving on.
  if (plan.probes.length >= 6 && rng.next() < tuning.doubleBackProb + 0.25) {
    const jitter = rng.next() * Math.PI * 2, x = plan.probes[2] + Math.cos(jitter) * 1.2, z = plan.probes[3] + Math.sin(jitter) * 1.2;
    const useJitter = nav.clear(x, z, agentRadius);
    plan.probes.splice(6, 0, useJitter ? x : plan.probes[2], useJitter ? z : plan.probes[3]);
    plan.doubleBackAt = 3;
  }
}
/**
 * Wander goal 6-16 m away on walkable ground in straight view, or false when none was found this tick. Candidates are
 * scored toward open ground (streets, sidewalks, squares: long sightlines), away from the infected's spawn area and
 * toward blocks where civilians are (`crowd`, civilians only, never the survivor), plus noise so drift stays unpredictable.
 */
export function wanderGoal(brain: L1Brain, rng: Rng, nav: ProbeTerrain & { visible(from: { x: number; z: number }, to: { x: number; z: number }, radius: number): boolean }, from: { x: number; z: number }, crowd: (x: number, z: number) => number = () => 0): boolean {
  let best = -Infinity;
  const homeDistance = Math.hypot(from.x - brain.homeX, from.z - brain.homeZ);
  for (let k = 0; k < 6; k++) {
    const angle = rng.next() * Math.PI * 2, r = 6 + rng.next() * 10, x = from.x + Math.cos(angle) * r, z = from.z + Math.sin(angle) * r;
    if (!nav.clear(x, z, agentRadius) || !nav.visible(from, { x, z }, agentRadius)) continue;
    const open = (nav.clear(x, z, 2) ? 0.5 : 0) + (nav.clear(x, z, 3.5) ? 0.5 : 0);
    const away = Math.max(-1, Math.min(1, (Math.hypot(x - brain.homeX, z - brain.homeZ) - homeDistance) / r)) * (brain.leashM && homeDistance > brain.leashM ? -2 : 1);
    const score = open * 0.9 + away * 0.6 + Math.min(1, crowd(x, z) / 4) * 1.2 + rng.next() * 0.8;
    if (score > best) { best = score; brain.goalX = x; brain.goalZ = z; }
  }
  if (best === -Infinity) return false;
  brain.hasGoal = true; return true;
}
