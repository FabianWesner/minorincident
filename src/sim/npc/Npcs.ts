import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { civilianRoles, npcs } from '../../data/npcs';
import { Traffic } from './Traffic';
import { Companion } from './Companion';
import { Escorts } from './Escorts';
import { Civilians } from './Civilians';
import type { Point } from './types';
/** E08 composition and reused E07 navigation. Public authoring hooks are also headless test hooks. */
export class Npcs {
  readonly civilians: Civilians;
  readonly companion: Companion;
  readonly escorts: Escorts;
  readonly traffic: Traffic;
  private ambientTarget = 0;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld) { this.civilians = new Civilians(world); this.companion = new Companion(world); this.escorts = new Escorts(world); this.traffic = new Traffic(world); }
  move(e: EntitySnapshot, target: Point, speed: number, path: { path: number[]; goal: number; pathIndex: number }, stop = .1): void {
    const nav = this.world.infected!.nav;
    let dx = target.x - e.transform.x, dz = target.z - e.transform.z, distance = Math.hypot(dx, dz);
    if (distance <= stop) return;
    if (!nav.visible(e.transform, target, .35)) {
      const goal = nav.cell(target.x, target.z);
      if (goal !== path.goal || path.pathIndex >= path.path.length) {
        if (!nav.path(nav.cell(e.transform.x, e.transform.z), goal, path.path, 300)) return;
        path.goal = goal; path.pathIndex = 0;
      }
      const cell = path.path[path.pathIndex]; this.waypoint.x = nav.x(cell); this.waypoint.z = nav.z(cell);
      dx = this.waypoint.x - e.transform.x; dz = this.waypoint.z - e.transform.z; distance = Math.hypot(dx, dz);
      if (distance < .15) { path.pathIndex++; return; }
    } else { path.path.length = 0; path.goal = -1; }
    const step = Math.min(distance, speed / 60);
    this.moveStep(e, dx / distance * step, dz / distance * step); e.transform.yaw = -Math.atan2(dz, dx);
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
      if (c) { c.entered += delta; for (const key of ['until', 'pauseUntil', 'knockedUntil'] as const) if (c[key]) c[key] += delta; }
      if (e.companion) { if (e.companion.until) e.companion.until += delta; if (e.companion.barkAt) e.companion.barkAt += delta; if (e.companion.hurtAt) e.companion.hurtAt += delta; }
      if (e.escort) { e.escort.downedAt += delta; if (e.escort.attackAt) e.escort.attackAt += delta; }
      if (e.infected) for (const key of ['until', 'cooldown', 'activeUntil', 'grabUntil', 'grabNextTick', 'scatterUntil'] as const) if (e.infected[key]) e.infected[key] += delta;
    }
    this.civilians.restore();
  }
  setQuality(tier: 'high' | 'low'): void {
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
