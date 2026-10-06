import { FIXED_DT } from '../../core/Clock';
import { l1v2 } from '../../data/l1v2';
import { survivor } from '../../data/survivor';
import type { InputFrame } from '../../input/InputFrame';
import type { NoBikeZone, Vec2 } from '../outbreak/types';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';

/** Serialized bicycle component (lives on the `bicycle` entity, so checkpoints restore it). `heading` is atan2(z, x). */
export interface BicycleState {
  mounted: boolean; heading: number; speed: number;
  /** Pedal crank phase and handlebar angle for the view; both derived, never read by the sim. */
  pedal: number; steer: number;
  /** Stand-to-mount timer in ticks; mounting re-arms only after the player has left the bicycle. */
  standTicks: number; armed: boolean; lockUntil: number;
}
const ARCHETYPE = 'veh.courier-bike';
const { speedMs, accelToMs, accelS, minTurnRadiusM, mountInteractS } = l1v2.bicycle;
const MOUNT_RANGE = 1.5, BUMP_RANGE = 1.15;
const inPolygon = (p: Vec2, poly: readonly Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if ((poly[i].z > p.z) !== (poly[j].z > p.z) && p.x < (poly[j].x - poly[i].x) * (p.z - poly[i].z) / (poly[j].z - poly[i].z) + poly[i].x) inside = !inside;
  }
  return inside;
};
/**
 * L1 v2 courier bicycle (spec 5.10). The rider is the normal survivor capsule: the bicycle only steers the movement intent
 * (heading with a bounded turn radius, 0 to 7 m/s in 1.5 s) and raises the controller speed scale, so walls, props and
 * crowds collide exactly like on foot. It deals no damage; touching an infected stops it and dismounts the rider.
 */
export class Bicycle {
  readonly noBikeZones: NoBikeZone[] = [];
  private id = -1;
  private lastOutside: Vec2 = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld) {}
  /** Creates the bicycle at `pos`; the integrator/mission calls this once per level (anchor `bike-start`). */
  spawn(pos: Vec2, heading = 0): number {
    const state: BicycleState = { mounted: false, heading, speed: 0, pedal: 0, steer: 0, standTicks: 0, armed: true, lockUntil: 0 };
    const e = this.world.entities.create({ kind: 'bicycle', archetype: ARCHETYPE, faction: 'environment', transform: { x: pos.x, y: 0, z: pos.z, yaw: -heading }, health: { current: 1, max: 1 }, bicycle: state });
    this.id = e.id; return e.id;
  }
  get entity(): EntitySnapshot | undefined {
    let e = this.world.entities.get(this.id);
    if (!e?.bicycle) { e = undefined; for (const c of this.world.entities.iterate()) if (c.bicycle) { e = c; this.id = c.id; break; } }
    return e;
  }
  get riding(): boolean { return this.entity?.bicycle?.mounted === true; }
  /** Controller speed scale (7.5 m/s over the 4.5 m/s run); 1 on foot. */
  get speedScale(): number { return this.riding ? speedMs / survivor.speed : 1; }
  addNoBikeZone(zone: NoBikeZone): void { this.noBikeZones.push(zone); }
  inNoBikeZone(p: Vec2): boolean { return this.noBikeZones.some(z => inPolygon(p, z.polygon)); }
  /** Applies the bicycle to this tick's effective input. Returns the same frame when nothing changes. */
  filter(frame: InputFrame): InputFrame {
    const bike = this.entity, b = bike?.bicycle, player = this.world.entities.get(1);
    if (!bike || !b || !player) return frame;
    const alive = player.health.current > 0 && player.survivor?.diedAt === null;
    if (!b.mounted) {
      b.speed = 0;
      const d = Math.hypot(player.transform.x - bike.transform.x, player.transform.z - bike.transform.z);
      if (d > 2) b.armed = true;
      const still = Math.hypot(frame.move.x, frame.move.z) < .05;
      b.standTicks = d <= MOUNT_RANGE && still && b.armed ? b.standTicks + 1 : 0;
      const free = alive && d <= MOUNT_RANGE && this.world.tick >= b.lockUntil && !this.inNoBikeZone(player.transform) && !this.world.vehicles?.active;
      if (free && (frame.interact || b.standTicks >= mountInteractS * 60)) {
        b.mounted = true; b.standTicks = 0; player.riding = bike.id; b.heading = -player.transform.yaw;
        this.lastOutside = { x: player.transform.x, z: player.transform.z };
        return { ...frame, interact: false };
      }
      return frame;
    }
    if (!alive) { this.dismount(bike, player); return frame; }
    if (frame.interact) { this.dismount(bike, player); return { ...frame, interact: false }; }
    // Contact with an infected stops the bicycle and dismounts the rider (no damage, no knockback).
    for (const e of this.world.entities.iterate()) {
      if (!e.infected || e.health.current <= 0 || e.hidden || e.infected.hidden) continue;
      if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= BUMP_RANGE) { this.dismount(bike, player); return frame; }
    }
    if (this.inNoBikeZone(player.transform)) { this.dismount(bike, player, this.lastOutside); return frame; }
    this.lastOutside = { x: player.transform.x, z: player.transform.z };
    // Speed actually achieved last tick: walls and props stop the bicycle.
    const loco = this.world.player!.locomotion, actual = Math.hypot(loco.displacement.x, loco.displacement.z) / FIXED_DT;
    if (actual < b.speed * .5) b.speed = actual;
    const want = Math.min(1, Math.hypot(frame.move.x, frame.move.z));
    let target = 0;
    if (want > 0) {
      const desired = Math.atan2(frame.move.z, frame.move.x), err = Math.atan2(Math.sin(desired - b.heading), Math.cos(desired - b.heading));
      const omega = Math.max(1.5, b.speed / minTurnRadiusM), turn = Math.sign(err) * Math.min(Math.abs(err), omega * FIXED_DT);
      b.heading += turn; b.steer = Math.max(-1, Math.min(1, turn / (omega * FIXED_DT || 1)));
      // Sharp turns shed speed so the bicycle never pivots at full speed.
      target = speedMs * want * Math.max(.35, Math.cos(Math.min(Math.abs(err), Math.PI / 2)) ** .5);
    } else b.steer = 0;
    const accel = accelToMs / accelS, change = target > b.speed ? accel * FIXED_DT : (want > 0 ? 9 : 6) * FIXED_DT;
    b.speed += Math.max(-change, Math.min(change, target - b.speed));
    b.pedal += b.speed * FIXED_DT * 1.8;
    const m = b.speed / speedMs;
    // The attack buttons are disabled while riding; a coasting bicycle with no input keeps its heading.
    const off = { down: false, held: false, up: false };
    const next: InputFrame = { ...frame, move: { x: Math.cos(b.heading) * m, z: Math.sin(b.heading) * m }, left: off, right: { ...off }, selector: 0, interact: false };
    delete next.attackTarget;
    return next;
  }
  /** Keeps the parked/ridden bicycle on the rider after physics. */
  postPhysics(): void {
    const bike = this.entity, b = bike?.bicycle, player = this.world.entities.get(1);
    if (!bike || !b || !player) return;
    if (b.mounted) { Object.assign(bike.transform, { x: player.transform.x, z: player.transform.z, yaw: -b.heading }); player.riding = bike.id; }
    else delete player.riding;
  }
  private dismount(bike: EntitySnapshot, player: EntitySnapshot, at?: Vec2): void {
    const b = bike.bicycle!;
    b.mounted = false; b.speed = 0; b.steer = 0; b.armed = false; b.lockUntil = this.world.tick + 18;
    delete player.riding;
    // The bicycle stays exactly where it was left; scripts never move it.
    // It is leaned against the left side of where the rider stood, so the rider does not overlap the frame.
    const x = at?.x ?? player.transform.x, z = at?.z ?? player.transform.z;
    Object.assign(bike.transform, { x: x - Math.sin(b.heading) * .9, z: z + Math.cos(b.heading) * .9, yaw: -b.heading });
    this.world.player!.locomotion.reset();
  }
}
