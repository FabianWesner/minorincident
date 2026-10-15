import { actorRadius } from '../world/SolidRegistry';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { civilianRoles, npcs } from '../../data/npcs';
import { Traffic } from './Traffic';
import { Companion } from './Companion';
import { Escorts } from './Escorts';
import { populateMorning } from './MorningRoutines';
import { Civilians } from './Civilians';
import { moveAgent } from '../locomotion/AgentMotion';
import type { Point } from './types';
/** E08 composition and reused E07 navigation. Public authoring hooks are also headless test hooks. */
export class Npcs {
  readonly civilians: Civilians;
  readonly companion: Companion;
  readonly escorts: Escorts;
  readonly traffic: Traffic;
  private ambientTarget = 0;
  private slice = false;
  private readonly waypoint = { x: 0, z: 0 };
  /** Last walk-out search per follower: repeated only after the body moved or half a second passed (E18 sim budget). */
  private readonly escapes = new Map<number, { x: number; z: number; tick: number; cell: number }>();
  /** A failed route search is retried after a second, not every tick (l4-collapse-2: a soldier sent to a post behind a closed
   * barricade ran a 1600-expansion A* per tick, 3 ms of every L4 war tick). */
  private readonly unreachable = new Map<number, { x: number; z: number; until: number }>();
  constructor(readonly world: SimWorld) {
    this.civilians = new Civilians(world); this.companion = new Companion(world); this.escorts = new Escorts(world); this.traffic = new Traffic(world); }
  /** False only when the target is unreachable (no route within the steering budget). */
  move(e: EntitySnapshot, target: Point, speed: number, path: { path: number[]; goal: number; pathIndex: number }, stop = .1, budget = 1600): boolean {
    const nav = this.world.infected!.nav, footprint = actorRadius(e);
    let dx = target.x - e.transform.x, dz = target.z - e.transform.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= stop) { if (e.companion?.velocity) e.companion.velocity.x = e.companion.velocity.z = 0; return true; }
    const l3Follower = !!e.civilian?.ally?.follow && !!this.world.missions?.def.l3;
    const cell = l3Follower ? nav.nearestCell(e.transform.x, e.transform.z, footprint) : -1;
    const flowNext = l3Follower && distance > 30 ? nav.flowNext(cell) : -1;
    if (l3Follower && cell < 0) {
      // Rounded bodies can enter an alley narrower than the baked crowd grid. Walk out; never teleport.
      const last = this.escapes.get(e.id), tick = this.world.tick;
      const fresh = !last || tick < last.tick || tick - last.tick >= 30 || Math.hypot(last.x - e.transform.x, last.z - e.transform.z) >= .1;
      const escape = fresh ? nav.escapeCell(e.transform, footprint, 8, false) : last.cell;
      if (fresh) this.escapes.set(e.id, { x: e.transform.x, z: e.transform.z, tick, cell: escape });
      if (escape < 0) return false;
      this.waypoint.x = nav.x(escape); this.waypoint.z = nav.z(escape);
    } else if (flowNext >= 0 && flowNext !== cell) {
      // Reuse the shared reverse field rather than starving a long per-officer A* search.
      this.waypoint.x = nav.x(flowNext); this.waypoint.z = nav.z(flowNext);
    } else if (e.civilian?.vehicleYield?.target === target && nav.visible(e.transform, target, footprint)) {
      // Kerb orders have a clear direct approach. A grid-centre detour can send
      // an actor back underneath the bus it is stepping away from.
      this.waypoint.x = target.x; this.waypoint.z = target.z;
    } else {
      // Quiet streets do not build a crowd flow field; followers still need their own route.
      const failed = this.unreachable.get(e.id), tick = this.world.tick;
      if (failed && tick < failed.until && Math.abs(failed.x - target.x) + Math.abs(failed.z - target.z) < .25) return false;
      if (!nav.steer(e.transform, target, path, footprint, this.waypoint, budget)) { this.unreachable.set(e.id, { x: target.x, z: target.z, until: tick + 60 }); return false; }
      if (failed) this.unreachable.delete(e.id);
    }
    dx = this.waypoint.x - e.transform.x; dz = this.waypoint.z - e.transform.z;
    const routed = Math.hypot(dx, dz); if (routed < .01) return true;
    const velocity = Math.min(speed, Math.max(0, distance - stop) * 4, l3Follower ? routed * 4 : Infinity);
    const vx = dx / routed * velocity, vz = dz / routed * velocity;
    this.moveStep(e, vx / 60, vz / 60);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z); return true;
  }
  moveStep(e: EntitySnapshot, dx: number, dz: number): void {
    if (e.passengerOf !== undefined || e.pendingAdmission) return;
    this.world.solids.wrote(e, 'npc.move');
    const x = e.transform.x, z = e.transform.z;
    moveAgent(e, dx * 60, dz * 60, this.world.infected!.nav, this.world.tick, actorRadius(e));
    if ((e.civilian || e.escort) && this.traffic.overlaps(e.transform)) { e.transform.x = x; e.transform.z = z; }
  }
  /** Place collision-safe rectangular routines from authored navigation, never inside buildings. */
  populate(count: number, offscreen = false): void {
    const nav = this.world.infected!.nav; let placed = 0;
    for (let z = nav.center.z - nav.ground.depth / 2 + 3; z < nav.center.z + nav.ground.depth / 2 - 6 && placed < count; z += 6) {
      for (let x = nav.center.x - nav.ground.width / 2 + 3; x < nav.center.x + nav.ground.width / 2 - 6 && placed < count; x += 6) {
        const points = [{ x, z }, { x: x + 3, z }, { x: x + 3, z: z + 3 }, { x, z: z + 3 }];
        if (offscreen && !this.world.infected!.director.offscreen(points[0])) continue;
        if (!points.every((p, i) => nav.visible(p, points[(i + 1) % 4], .65))) continue;
        const role = civilianRoles[placed % civilianRoles.length];
        const id = this.civilians.spawn(role.role, points[0], { waypoints: points, ambient: true });
        if (role.routine === 'walk-dog') this.civilians.spawn('dog', points[0], { pet: 'dog', owner: id, ambient: true, waypoints: [points[0]] });
        placed++;
      }
    }
    if (!offscreen && placed !== count) throw new Error('Insufficient safe civilian routines');
  }
  /** Per-level campaign authoring entry point; density is quality-scaled and pets are separate. */
  configure(level: number, tier: 'high' | 'low' = 'high', count = Math.round(npcs.density[level - 1] * (tier === 'low' ? .6 : 1))): void {
    if (!Number.isInteger(level) || level < 1 || level > 6) throw new RangeError('Invalid NPC level');
    this.civilians.level = level; this.world.infected!.director.levelCap = npcs.caps[level - 1]; this.world.infected!.director.tier = tier; this.ambientTarget = count; this.populate(Math.floor(count));
  }
  /** M1 morning is a small authored neighborhood, with exactly one companion. */
  configureSlice(driver?: Point): void {
    this.slice=true;this.ambientTarget=0;
    for(const e of this.world.entities.iterate()) if(e.civilian?.ambient || e.traffic) { this.world.entities.delete(e.id);this.world.spatial.delete(e.id); }
    const nav = this.world.infected!.nav;
    populateMorning(this.world);
    if(driver) {
      const cell=nav.nearestCell(driver.x,driver.z),p={x:nav.x(cell),z:nav.z(cell)};
      if(nav.clear(p.x,p.z,.35))this.civilians.spawn('delivery-driver',p,{waypoints:[p]});
    }
    this.world.infected!.director.levelCap=15;
  }
  /** The healthy delivery driver becomes the slice's named infected actor at the incident. */
  sliceIncident(position: Point): void {
    for(const e of this.world.entities.iterate())if(e.archetype==='npc.delivery-driver' && e.civilian){
      e.civilian.state='infected';e.hidden=true;this.world.spatial.delete(e.id);
      const infectedId=this.world.missions?.state.actors['incident-0'];
      if(infectedId!==undefined)this.world.events.emit({type:'civilian.turned',tick:this.world.tick,id:e.id,infectedId,variant:e.civilian.variant,position:{...e.transform}});
    }
    this.civilians.alarm(position);
  }
  /** L1 story beat; placement is clamped to clear ground near the loaded diner anchor. */
  dinerIncident(position: Point): void {
    const nav = this.world.infected!.nav;
    for (let radius = 1; radius <= 8; radius++) for (let i = 0; i < 8; i++) {
      const p = { x: position.x + Math.cos(i * Math.PI / 4) * radius, z: position.z + Math.sin(i * Math.PI / 4) * radius };
      if (!nav.clear(p.x, p.z, .65)) continue;
      const id = this.civilians.spawn('cashier', p, { waypoints: [p] }), attacker = this.world.infected!.spawn('infected.runner', p);
      this.civilians.grab(id, attacker, true); return;
    }
    throw new Error('No safe diner incident placement');
  }
  /** Checkpoint restoration rebinds E07's pooled brains and preserves remaining NPC timer durations. */
  restore(delta: number): void {
    const ai = this.world.infected!;
    for (const e of ai.active) ai.pool.push(e);
    ai.active.length = 0; ai.director.queue.length = 0;
    for (const e of this.world.entities.iterate()) {
      if (e.infected && !e.corpse) { ai.pool.pop(); ai.active.push(e); }
      const c = e.civilian;
      if (c) { c.entered += delta; for (const key of ['until', 'pauseUntil', 'knockedUntil', 'activityUntil', 'activityStarted'] as const) if (c[key]) c[key]! += delta; if (c.vehicleYield) c.vehicleYield.until += delta; if (c.lastTravelProgress !== undefined) c.lastTravelProgress += delta; }
      if (e.companion) { if (e.companion.until) e.companion.until += delta; if (e.companion.barkAt) e.companion.barkAt += delta; if (e.companion.hurtAt) e.companion.hurtAt += delta; }
      if (e.escort) { e.escort.downedAt += delta; if (e.escort.attackAt) e.escort.attackAt += delta; if (e.escort.knockedUntil) e.escort.knockedUntil += delta; }
      if (e.infectionRise) { e.infectionRise.started += delta; e.infectionRise.until += delta; }
      if (c?.survivor?.waitAt) c.survivor.waitAt += delta;
      const l1 = e.civilian?.l1; if (l1) { l1.repickAt += delta; if (l1.noticed >= 0) l1.noticed += delta; if (l1.graceUntil) l1.graceUntil += delta; if (l1.progressAt !== undefined) l1.progressAt += delta; if (l1.doorAt !== undefined) l1.doorAt += delta; }
      if (e.infection) { e.infection.startedTick += delta; e.infection.endsTick += delta; }
      if (e.infected) for (const key of ['until', 'cooldown', 'activeUntil', 'grabUntil', 'grabNextTick', 'scatterUntil'] as const) if (e.infected[key]) e.infected[key] += delta;
      if (e.infected) ai.restoreSpecialTimers(e.infected, delta);
      if (e.infected && e.infected.recoverAt >= 0) { e.infected.recoverAt += delta; e.infected.deadAt += delta; }
    }
    this.civilians.restore(); this.civilians.outbreak?.restore(delta);
    this.companion.respawnNear();
  }
  /** Stop density maintenance (L1 v2 owns its population through the outbreak layer). */
  setAmbient(count: number): void { this.ambientTarget = count; }
  setQuality(tier: 'high' | 'low'): void {
    if(this.slice)return;
    // L10 is authored as an empty journey until the bounded epilogue cast emerges.
    if (this.world.scenario === 'L10') { this.world.infected!.director.setTier(tier); this.ambientTarget = 0; return; }
    if (this.civilians.outbreak) { this.world.infected!.director.tier = tier; return; }
    this.world.infected!.director.setTier(tier);
    this.ambientTarget = Math.round(npcs.density[this.civilians.level - 1] * (tier === 'low' ? .6 : 1));
  }
  private density(): void {
    if (!this.ambientTarget || this.world.tick % 60 !== 0) return;
    // Fractional low-tier targets (e.g. L5=3.6) alternate counts over ten seconds, preserving the average.
    const floor = Math.floor(this.ambientTarget), fraction = this.ambientTarget - floor;
    const desired = floor + Number(fraction > 0 && this.world.tick % 600 >= Math.round((1 - fraction) * 600));
    let count = 0;
    for (const e of this.world.entities.iterate()) if (e.civilian?.ambient && !e.civilian.pet && !e.hidden && e.civilian.state !== 'finished') count++;
    // Density and quality cap future arrivals; existing people keep their IDs.
    if (count < desired) this.populate(desired - count, true);
  }
  update(): void { this.density(); this.civilians.update(); this.companion.update(); this.escorts.update(); this.traffic.update(); }
}
