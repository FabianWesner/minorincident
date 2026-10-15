import { survivor } from '../../data/survivor';
import { worldAssets } from '../../assets/worldDefinitions';
import { SimPhase } from '../../core/EventBus';
import { l4, l4RoutePose, type l4Route } from '../../data/l4';
import { resetResponse } from '../locomotion/MotionResponse';
import { leaveSeat } from '../npc/MorningRoutines';
import type { Point } from '../npc/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot, Transform } from '../world/types';
import type { L4State } from './types';

/** Clearance includes knees, bent torso, bags and quadruped length, rather than just the combat capsule. */
export function convoyFootprint(e: EntitySnapshot): number {
  if (e.id === 1) return survivor.radius;
  const c = e.civilian, seat = c?.schedule?.[c.scheduleStep ?? 0]?.seat;
  const offset = seat && c?.activityUntil && (c.state === 'calm' || c.state === 'alarmed') ? Math.hypot(seat.x - e.transform.x, seat.z - e.transform.z) : 0;
  return Math.max(e.combat?.radius ?? .35, (c?.pet || e.companion || /\.(dog|cat)/.test(e.archetype) ? .95 : .9) + (offset <= 1.2 ? offset : 0));
}
const actor = (e: EntitySnapshot) => !e.hidden && !e.corpse && e.health.current > 0 && !!(e.civilian || e.infected || e.companion || e.escort || e.id === 1);

/** three.js +Y yaw: longitudinal +X rotates toward -Z. Circle against the expanded rendered OBB. */
export function convoyOverlaps(t: Point & { yaw: number }, i: number, p: Point, radius: number): boolean {
  const v = l4.convoy.vehicles[i], dx = p.x - t.x, dz = p.z - t.z;
  const bound = (v.len + v.wid) / 2 + .3 + radius;
  if (Math.abs(dx) > bound || Math.abs(dz) > bound) return false;
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - v.len / 2 - .3), Math.max(0, Math.abs(dx * s + dz * c) - v.wid / 2 - .3)) < radius;
}

/** L4's scripted vehicles yield to actors; pedestrians use the existing siren kerb-walk order. */
export class L4ConvoyClearance {
  private readonly previous = new Map<number, Transform>();
  private installed = false;
  constructor(private readonly world: SimWorld, private readonly state: () => L4State, private readonly route: ReturnType<typeof l4Route>) {}

  install(): void {
    // Population is authored before the first frame. Resolve unsafe spawn points before they can be seen.
    const fuel = l4.fuelTruck, size = worldAssets['veh.fuel-truck'].dimensions;
    const inFuel = (e: EntitySnapshot) => Math.hypot(Math.max(0, Math.abs(e.transform.x - fuel.x) - size.z / 2 - .3), Math.max(0, Math.abs(e.transform.z - fuel.z) - size.x / 2 - .3)) < convoyFootprint(e) + .1;
    for (const e of this.world.entities.iterate()) if (actor(e) && (this.swept(e.transform, convoyFootprint(e) + .4, 18) || inFuel(e))) {
      const p = this.safePoint(e.transform, convoyFootprint(e), true);
      if (e.civilian) leaveSeat(e);
      this.place(e, p);
    }
    if (this.installed) return;
    this.installed = true;
    this.world.events.on('sim.tick', () => {
      this.previous.clear();
      for (const e of this.world.entities.iterate()) if (actor(e)) this.previous.set(e.id, { ...e.transform });
      if (this.world.tick % 6 === 0) this.warn();
    }, SimPhase.input);
    // Includes NPC steering, crowd separation, inertial braking and the parked/unloading phases.
    this.world.events.on('sim.tick', () => this.constrain(), SimPhase.cleanup + .25);
  }
  rememberUnloaded(): void {
    for (const e of this.world.entities.iterate()) if (actor(e) && !this.previous.has(e.id)) this.previous.set(e.id, { ...e.transform });
  }
  /** Keep normal routines reachable after the parked vehicles occupy the plaza. */
  parkRoutines(): void {
    for (const e of this.world.entities.iterate()) {
      const c = e.civilian; if (!c || e.infected) continue;
      const radius = convoyFootprint(e);
      let changed = false;
      const clear = (p: Point): Point => {
        if (!this.overlaps(p, radius)) return p;
        changed = true; return this.safePoint(p, radius);
      };
      for (const activity of c.schedule ?? []) {
        activity.target = clear(activity.target);
        if (activity.seat && this.overlaps(activity.seat, radius)) {
          delete activity.seat; delete activity.seatLift; delete activity.seatProp;
          activity.activity = 'look'; changed = true;
        }
      }
      c.waypoints = c.waypoints.map(clear);
      if (c.ally?.post) c.ally.post = clear(c.ally.post);
      if (c.ally?.run) c.ally.run = clear(c.ally.run);
      if (changed) { c.goal = -1; c.path.length = 0; c.pathIndex = 0; c.activityUntil = 0; c.lastTravelProgress = this.world.tick; }
    }
  }
  private place(e: EntitySnapshot, p: Point): void {
    Object.assign(e.transform, p); this.world.spatial.set(e.id, p.x, p.z);
    if (e.id === 1) {
      this.world.physics.playerBody!.setTranslation(e.transform, true);
      this.world.physics.playerBody!.setNextKinematicTranslation(e.transform);
    }
  }
  overlaps(p: Point, radius: number): boolean {
    return this.state().convoyIds.some((id, i) => {
      const v = this.world.entities.get(id); return !!v && !v.hidden && convoyOverlaps(v.transform, i, p, radius);
    });
  }
  /** Used for initial placement and bus doors; checks ALL vehicles and navigation before placing anyone. */
  safePoint(p: Point, radius: number, ahead = false): Point {
    const nav = this.world.infected!.nav;
    for (let d = 0; d <= 16; d += .25) for (let k = 0; k < (d ? 32 : 1); k++) {
      const q = { x: p.x + Math.cos(k * Math.PI / 16) * d, z: p.z + Math.sin(k * Math.PI / 16) * d };
      if (!(ahead ? this.swept(q, radius + .5, 18) : this.overlaps(q, radius + .1)) && nav.clear(q.x, q.z, .35)) return q;
    }
    throw new Error('L4 convoy has no clear unloading/spawn point');
  }
  /** Reject a single unsafe movement step, before rendering; never push a visible actor sideways. */
  constrain(): void {
    for (const e of this.world.entities.iterate()) {
      if (!actor(e) || !this.overlaps(e.transform, convoyFootprint(e))) continue;
      const old = this.previous.get(e.id);
      if (old && !this.overlaps(old, convoyFootprint(e))) {
        this.place(e, old); if (e.locomotion) resetResponse(e.locomotion);
      } else if (this.world.infected!.director.offscreen(e.transform)) this.place(e, this.safePoint(e.transform, convoyFootprint(e)));
    }
  }
  private lookahead(): number { return Math.max(18, this.state().convoyV * 2 + this.state().convoyV ** 2 / (2 * l4.convoy.brakeMs2)); }
  private clearWalk(from: Point, to: Point, radius: number): boolean {
    const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .25);
    for (let k = 1; k <= n; k++) if (this.overlaps({ x: from.x + (to.x - from.x) * k / n, z: from.z + (to.z - from.z) * k / n }, radius)) return false;
    return true;
  }
  private swept(p: Point, radius: number, distance: number): boolean {
    const s = this.state();
    for (let i = 0; i < s.convoyS.length; i++) for (let d = 0; d <= distance; d += 1) {
      if (convoyOverlaps(l4RoutePose(this.route, Math.min(s.convoyS[i] + d, this.route.length)), i, p, radius + .2)) return true;
    }
    return this.overlaps(p, radius);
  }
  private warn(): void {
    // Once parked, normal navigation owns pedestrian routes. Renewing kerb
    // orders beside an idle bus would keep evacuees from ever joining the queue.
    if (this.state().phase !== 'convoy') return;
    const nav = this.world.infected!.nav, distance = this.lookahead();
    for (const e of this.world.entities.iterate()) {
      const c = e.civilian;
      if (!actor(e) || !c || e.infected || !['calm', 'hide', 'alarmed', 'flee'].includes(c.state)) continue;
      const r = convoyFootprint(e);
      if (c.vehicleYield && !this.swept(c.vehicleYield.target, r, distance)) {
        if (this.swept(e.transform, r + 1, distance)) c.vehicleYield.until = this.world.tick + 180;
        continue;
      }
      if (!this.swept(e.transform, r + .5, distance)) continue;
      // Nearest safe kerb reached along a clear line. It must clear the entire turning column, not just one bus.
      let target: Point | undefined;
      for (let d = 1; d <= 10 && !target; d += .5) for (let k = 0; k < 16 && !target; k++) {
        const q = { x: e.transform.x + Math.cos(k * Math.PI / 8) * d, z: e.transform.z + Math.sin(k * Math.PI / 8) * d };
        if (!this.swept(q, r + .4, distance) && nav.clear(q.x, q.z, .35) && nav.visible(e.transform, q, .35) && this.clearWalk(e.transform, q, r)) target = q;
      }
      if (target) {
        leaveSeat(e); c.story = null; c.activityUntil = 0;
        c.vehicleYield = { target, until: this.world.tick + 180 };
      }
    }
  }
  /** Smooth braking toward the first occupied route sample. Last-tick hull check below is authoritative. */
  speedLimit(): number {
    const s = this.state(), actors = [...this.world.entities.iterate()].filter(actor).map(e => ({ p: e.transform, r: convoyFootprint(e) + .05 })), distance = this.lookahead();
    for (let d = 0; d <= distance; d += .5) for (let i = 0; i < s.convoyS.length; i++) {
      const p = l4RoutePose(this.route, s.convoyS[i] + d);
      if (actors.some(a => convoyOverlaps(p, i, a.p, a.r))) return Math.sqrt(2 * l4.convoy.brakeMs2 * .8 * Math.max(0, d - .5));
    }
    return Infinity;
  }
  /** Check actual eased yaw as well as route tangent, including the whole next movement step. */
  canAdvance(poses: readonly Transform[]): boolean {
    for (const e of this.world.entities.iterate()) if (actor(e)) {
      const radius = convoyFootprint(e) + .05;
      for (const [i, p] of poses.entries()) {
        const v = this.world.entities.get(this.state().convoyIds[i])!;
        for (const f of [.25, .5, .75, 1]) if (convoyOverlaps({ x: v.transform.x + (p.x - v.transform.x) * f, z: v.transform.z + (p.z - v.transform.z) * f, yaw: v.transform.yaw + (p.yaw - v.transform.yaw) * f }, i, e.transform, radius)) return false;
      }
    }
    return true;
  }
}
