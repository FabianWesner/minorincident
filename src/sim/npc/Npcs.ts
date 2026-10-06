import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { civilianRoles, npcs } from '../../data/npcs';
import { Traffic } from './Traffic';
import { Companion } from './Companion';
import { Escorts } from './Escorts';
import { populateMorning } from './MorningRoutines';
import { Civilians } from './Civilians';
import { SimPhase } from '../../core/EventBus';
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
  constructor(readonly world: SimWorld) {
    const previous = new Map<number, Point>();
    world.events.on('sim.tick', () => {
      previous.clear();
      for (const e of world.entities.iterate()) if (e.civilian || e.companion || e.escort) previous.set(e.id, { x: e.transform.x, z: e.transform.z });
    }, SimPhase.intent);
    world.events.on('sim.tick', () => {
      for (const e of world.entities.iterate()) {
        const p = previous.get(e.id); if (!p) continue;
        if (world.districts) e.transform.y = (e.companion || e.civilian?.pet ? .3 : .7) + world.districts.groundHeight(e.transform.x, e.transform.z);
        const dx = e.transform.x - p.x, dz = e.transform.z - p.z, distance = Math.hypot(dx, dz);
        const motion = e.motion ??= { velocity: { x: 0, z: 0 }, speed: 0, moving: false, distance: 0 };
        motion.velocity.x = dx * 60; motion.velocity.z = dz * 60; motion.speed = distance * 60;
        motion.moving = motion.speed > (motion.moving ? .04 : .12); motion.distance += distance;
      }
    }, SimPhase.cleanup);
    this.civilians = new Civilians(world); this.companion = new Companion(world); this.escorts = new Escorts(world); this.traffic = new Traffic(world); }
  move(e: EntitySnapshot, target: Point, speed: number, path: { path: number[]; goal: number; pathIndex: number }, stop = .1): void {
    const nav = this.world.infected!.nav;
    let dx = target.x - e.transform.x, dz = target.z - e.transform.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= stop) { if (e.companion?.velocity) e.companion.velocity.x = e.companion.velocity.z = 0; return; }
    if (!nav.steer(e.transform, target, path, .35, this.waypoint)) return;
    dx = this.waypoint.x - e.transform.x; dz = this.waypoint.z - e.transform.z;
    const routed = Math.hypot(dx, dz); if (routed < .01) return;
    let vx = dx / routed * Math.min(speed, Math.max(0, distance - stop) * 4), vz = dz / routed * Math.min(speed, Math.max(0, distance - stop) * 4);
    if (e.companion) {
      const v = e.companion.velocity ??= { x: 0, z: 0 }, delta = Math.hypot(vx - v.x, vz - v.z), amount = Math.min(1, .3 / (delta || 1));
      v.x += (vx - v.x) * amount; v.z += (vz - v.z) * amount; vx = v.x; vz = v.z;
    }
    const before = { x: e.transform.x, z: e.transform.z };
    this.moveStep(e, vx / 60, vz / 60);
    const actualX = e.transform.x - before.x, actualZ = e.transform.z - before.z;
    if (Math.hypot(actualX, actualZ) > .0005) {
      const yaw = -Math.atan2(actualZ, actualX), delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
      e.transform.yaw += Math.max(-.12, Math.min(.12, delta));
    }
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  moveStep(e: EntitySnapshot, dx: number, dz: number): void {
    const x = e.transform.x, z = e.transform.z;
    this.world.infected!.nav.move(e.transform, dx, dz, .35);
    if ((e.civilian || e.escort) && this.traffic.overlaps(e.transform)) { e.transform.x = x; e.transform.z = z; }
  }
  /** Place collision-safe rectangular routines from authored navigation, never inside buildings. */
  populate(count: number): void {
    const nav = this.world.infected!.nav; let placed = 0;
    for (let z = nav.center.z - nav.ground.depth / 2 + 3; z < nav.center.z + nav.ground.depth / 2 - 6 && placed < count; z += 6) {
      for (let x = nav.center.x - nav.ground.width / 2 + 3; x < nav.center.x + nav.ground.width / 2 - 6 && placed < count; x += 6) {
        const points = [{ x, z }, { x: x + 3, z }, { x: x + 3, z: z + 3 }, { x, z: z + 3 }];
        if (!points.every((p, i) => nav.visible(p, points[(i + 1) % 4], .65))) continue;
        const role = civilianRoles[placed % civilianRoles.length];
        const id = this.civilians.spawn(role.role, points[0], { waypoints: points, ambient: true });
        if (role.routine === 'walk-dog') this.civilians.spawn('dog', points[0], { pet: 'dog', owner: id, ambient: true, waypoints: [points[0]] });
        placed++;
      }
    }
    if (placed !== count) throw new Error('Insufficient safe civilian routines');
  }
  /** Per-level campaign authoring entry point; density is quality-scaled and pets are separate. */
  configure(level: number, tier: 'high' | 'low' = 'high', count = npcs.density[level - 1] * (tier === 'low' ? .6 : 1)): void {
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
      if (e.infected) { ai.pool.pop(); ai.active.push(e); }
      const c = e.civilian;
      if (c) { c.entered += delta; for (const key of ['until', 'pauseUntil', 'knockedUntil', 'activityUntil', 'activityStarted'] as const) if (c[key]) c[key]! += delta; if (c.travelStarted !== undefined) c.travelStarted += delta; }
      if (e.companion) { if (e.companion.until) e.companion.until += delta; if (e.companion.barkAt) e.companion.barkAt += delta; if (e.companion.hurtAt) e.companion.hurtAt += delta; }
      if (e.escort) { e.escort.downedAt += delta; if (e.escort.attackAt) e.escort.attackAt += delta; }
      if (e.infected) for (const key of ['until', 'cooldown', 'activeUntil', 'grabUntil', 'grabNextTick', 'scatterUntil'] as const) if (e.infected[key]) e.infected[key] += delta;
    }
    this.civilians.restore();
  }
  setQuality(tier: 'high' | 'low'): void {
    if(this.slice)return;
    for (const e of this.world.entities.iterate()) if (e.civilian?.ambient) { this.world.spatial.delete(e.id); this.world.entities.delete(e.id); }
    this.configure(this.civilians.level, tier);
  }
  private density(): void {
    if (!this.ambientTarget || this.world.tick % 60 !== 0) return;
    // Fractional low-tier targets (e.g. L5=3.6) alternate counts over ten seconds, preserving the average.
    const floor = Math.floor(this.ambientTarget), fraction = this.ambientTarget - floor;
    const desired = floor + Number(fraction > 0 && this.world.tick % 600 >= Math.round((1 - fraction) * 600));
    let count = 0, removable: EntitySnapshot | undefined;
    for (const e of this.world.entities.iterate()) if (e.civilian?.ambient && !e.civilian.pet && !e.hidden && e.civilian.state !== 'finished') { count++; if (e.civilian.state === 'calm') removable = e; }
    if (count < desired) this.populate(desired - count);
    else if (count > desired && removable) {
      this.world.entities.delete(removable.id); this.world.spatial.delete(removable.id);
      for (const e of this.world.entities.iterate()) if (e.civilian?.owner === removable.id && e.civilian.state === 'calm') { this.world.entities.delete(e.id); this.world.spatial.delete(e.id); }
    }
  }
  update(): void { this.density(); this.civilians.update(); this.companion.update(); this.escorts.update(); this.traffic.update(); }
}
