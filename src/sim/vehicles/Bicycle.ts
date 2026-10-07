import { FIXED_DT } from '../../core/Clock';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { bicycleGeometry as geometry } from '../../data/bicycleGeometry';
import { inside } from '../../levels/districts/validate';
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
const { speedMs, accelToMs, accelS, mountInteractS } = l1v2.bicycle;
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
  private claimedAt = -Infinity;
  readonly noBikeZones: NoBikeZone[] = [];
  /** Points where an empty-handed rider dismounts and parks the bike in view (the depot: the parcel is carried afterwards). */
  readonly parkPoints: { x: number; z: number; radius: number; spot?: Vec2 }[] = [];
  private mountedInPark = false;
  private id = -1;
  private lastOutside: Vec2 = { x: 0, z: 0 };
  private lastPark: { x: number; z: number; yaw: number; y: number } | null = null;
  private navPose = '';
  constructor(private readonly world: SimWorld) {}
  /** Creates the bicycle at `pos`; the integrator/mission calls this once per level (anchor `bike-start`). */
  spawn(pos: Vec2, heading = 0): number {
    const state: BicycleState = { mounted: false, heading, speed: 0, pedal: 0, steer: 0, standTicks: 0, armed: true, lockUntil: 0 };
    const parking = this.parkingSpot(pos.x, pos.z, heading, [0, .6, 1.2, 1.8, 2.4, 3, 4, 5, 6, 8]);
    if (!parking) throw new Error('No clear pavement for courier bicycle');
    const spot = parking; heading = parking.heading; state.heading = heading;
    const e = this.world.entities.create({ kind: 'bicycle', archetype: ARCHETYPE, faction: 'environment', transform: { x: spot.x, y: this.world.districts?.pavingHeight(spot.x, spot.z) ?? 0, z: spot.z, yaw: -heading }, health: { current: 1, max: 1 }, bicycle: state });
    this.lastPark = { ...e.transform };
    this.id = e.id; this.postPhysics(); return e.id;
  }
  get entity(): EntitySnapshot | undefined {
    let e = this.world.entities.get(this.id);
    if (!e?.bicycle) { e = undefined; for (const c of this.world.entities.iterate()) if (c.bicycle) { e = c; this.id = c.id; break; } }
    return e;
  }
  get riding(): boolean { return this.entity?.bicycle?.mounted === true; }
  canInteract(): boolean {
    const bike = this.entity, player = this.world.entities.get(1);
    return !!bike?.bicycle && !!player && player.health.current > 0 && (bike.bicycle.mounted || this.world.tick >= bike.bicycle.lockUntil && Math.hypot(player.transform.x - bike.transform.x, player.transform.z - bike.transform.z) <= MOUNT_RANGE && !this.atNoBikeZone(bike.transform) && !this.atNoBikeZone(player.transform));
  }
  /** Controller speed scale (7.5 m/s over the 4.5 m/s run); 1 on foot. */
  get speedScale(): number { return this.riding ? speedMs / survivor.speed : 1; }
  addNoBikeZone(zone: NoBikeZone): void { this.noBikeZones.push(zone); }
  inNoBikeZone(p: Vec2): boolean { return this.noBikeZones.some(z => inPolygon(p, z.polygon)); }
  /** Inside a zone or within `margin` metres of its edge (a fence on the border stops the rider just outside it). */
  atNoBikeZone(p: Vec2, margin = .6): boolean {
    return this.noBikeZones.some(z => inPolygon(p, z.polygon) || z.polygon.some((a, i) => {
      const b = z.polygon[(i + 1) % z.polygon.length], dx = b.x - a.x, dz = b.z - a.z, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz) <= margin;
    }));
  }
  /** Applies the bicycle to this tick's effective input. Returns the same frame when nothing changes. */
  filter(frame: InputFrame): InputFrame {
    const bike = this.entity, b = bike?.bicycle, player = this.world.entities.get(1);
    if (!bike || !b || !player) return frame;
    const alive = player.health.current > 0 && player.survivor?.diedAt === null;
    if (!b.mounted) {
      b.speed = 0;
      const d = Math.hypot(player.transform.x - bike.transform.x, player.transform.z - bike.transform.z);
      if (d > 2) b.armed = true;
      // Wedged bike (under an awning, inside props): when the courier is close, it steps out to the nearest clear spot.
      if (d <= 3 && this.world.tick % 20 === 0 && !this.clearAt(bike.transform.x, bike.transform.z, -bike.transform.yaw)) {
        const spot = this.clearSpot(player.transform.x, player.transform.z, -bike.transform.yaw); if (spot) { Object.assign(bike.transform, spot, { y: this.world.districts?.pavingHeight(spot.x, spot.z) ?? 0 }); }
      }
      const still = Math.hypot(frame.move.x, frame.move.z) < .05;
      // At the depot the courier waits for the parcel, rather than immediately auto-mounting the parked bike.
      const waitingAtDepot = !player.survivor?.carrying && this.parkPoints.some(p => Math.hypot(p.x - player.transform.x, p.z - player.transform.z) <= p.radius);
      b.standTicks = d <= MOUNT_RANGE && still && b.armed && !waitingAtDepot ? b.standTicks + 1 : 0;
      const free = alive && this.canInteract() && !this.world.vehicles?.active;
      if (free && !this.world.missions?.interactionAvailable() && (frame.interact || b.standTicks >= mountInteractS * 60)) {
        // Mount the entire frame on level pavement, including its forward saddle offset.
        // Prefer the parked heading; the rider's old facing can put the cargo box into a rack hoop.
        b.heading = -bike.transform.yaw;
        const spot = this.clearSpot(player.transform.x, player.transform.z, b.heading, [0, .3, .6, .9, 1.2, 1.6, 2.2, 3, 4, 6, 8], true);
        if (!spot) return frame;
        const mountedInPark = this.parkPoints.some(p => Math.hypot(p.x - player.transform.x, p.z - player.transform.z) <= p.radius);
        Object.assign(player.transform, spot, { y: (this.world.districts?.pavingHeight(spot.x, spot.z) ?? 0) + survivor.height / 2 + .02, yaw: -b.heading });
        this.world.physics.playerBody?.setTranslation(player.transform, true); this.world.player?.locomotion.reset(); this.world.controls.reset(); this.world.spatial.set(1, spot.x, spot.z);
        b.mounted = true; b.standTicks = 0; player.riding = bike.id;
        this.lastOutside = { x: player.transform.x, z: player.transform.z };
        this.mountedInPark = mountedInPark;
        return { ...frame, interact: false };
      }
      return frame;
    }
    if (!alive) { this.dismount(bike, player); return frame; }
    // Interact priority: an objective or device in reach takes the press; dismount only if nothing else does.
    const claimed = this.world.missions?.interactionAvailable() || this.world.interactables?.activeId != null;
    if (claimed) this.claimedAt = this.world.tick;
    // A ring that just completed by standing in it (stand-to-interact) still owns a late `E` for 1.5 s:
    // the press the player meant for the counter must not also drop them off the bicycle (QA1-01).
    if (frame.interact && !claimed && this.world.tick - this.claimedAt > 90) { this.dismount(bike, player); return { ...frame, interact: false }; }
    // Contact with an infected stops the bicycle and dismounts the rider (no damage, no knockback).
    for (const e of this.world.entities.iterate()) {
      if (!e.infected || e.health.current <= 0 || e.hidden || e.infected.hidden) continue;
      if (Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) <= BUMP_RANGE) { this.dismount(bike, player); return frame; }
    }
    if (this.atNoBikeZone(player.transform)) { this.dismount(bike, player, this.lastOutside); return frame; }
    // Arriving at the depot without the parcel: she hops off and the bike is parked visibly right there.
    const park = this.parkPoints.find(p => Math.hypot(p.x - player.transform.x, p.z - player.transform.z) <= p.radius);
    const inPark = !!park;
    if (!inPark) this.mountedInPark = false;
    else if (!this.mountedInPark && !player.survivor?.carrying) {
      this.dismount(bike, player);
      // The depot has a clear curb spot beside the counter approach, within remount reach after hand-over.
      if (park?.spot && this.clearAt(park.spot.x, park.spot.z, Math.PI / 2)) {
        Object.assign(bike.transform, park.spot, { y: this.world.districts?.pavingHeight(park.spot.x, park.spot.z) ?? 0, yaw: -Math.PI / 2 }); b.heading = Math.PI / 2;
        this.lastPark = { ...bike.transform };
      }
      return frame;
    }
    this.lastOutside = { x: player.transform.x, z: player.transform.z };
    // Speed actually achieved last tick: walls and props stop the bicycle.
    const loco = this.world.player!.locomotion, actual = Math.hypot(loco.displacement.x, loco.displacement.z) / FIXED_DT;
    if (actual < b.speed * .5) b.speed = actual;
    // QA1-02: click-to-move rides exactly like walking (same nav route, steering and corner clearance), only
    // faster (speedScale); the bicycle's own heading model is for direct WASD/stick steering. The steering-
    // model version pinned itself on fence corners where the route turns tighter than the bike can.
    if (frame.navigation) {
      const v = loco.velocity, speed = Math.hypot(v.x, v.z);
      if (speed > .2) { const desired = Math.atan2(v.z, v.x), err = Math.atan2(Math.sin(desired - b.heading), Math.cos(desired - b.heading)); b.steer = Math.max(-1, Math.min(1, err * 2)); b.heading = desired; } else b.steer = 0;
      b.speed = actual; b.pedal += b.speed * FIXED_DT * 1.8;
      const off = { down: false, held: false, up: false };
      const routed: InputFrame = { ...frame, left: off, right: { ...off }, selector: 0, interact: !!claimed && frame.interact };
      delete routed.attackTarget; return routed;
    }
    // Bicycle kinematics: the steering angle shrinks with speed (turn radius 1.6 m crawling, 6 m flat out), the heading changes by
    // speed / radius, so the bike never pivots on the spot; speed ramps (0 to 7 m/s in 1.5 s), brakes hard, coasts gently.
    const want = Math.min(1, Math.hypot(frame.move.x, frame.move.z)), r = b.speed / speedMs;
    let target = 0, steerTarget = 0;
    if (want > 0) {
      const desired = Math.atan2(frame.move.z, frame.move.x), err = Math.atan2(Math.sin(desired - b.heading), Math.cos(desired - b.heading));
      steerTarget = Math.max(-1, Math.min(1, err / .7));
      // Sharp turns shed speed; a turn straight behind slows to a crawl before swinging round.
      target = speedMs * want * Math.max(.3, Math.cos(Math.min(Math.abs(err), Math.PI / 2)) ** .5);
    }
    b.steer += (steerTarget - b.steer) * Math.min(1, 8 * FIXED_DT);
    const radius = 1.6 + (6 - 1.6) * r;
    // At an obstacle, the rider can still walk the front wheel round to pull away.
    // Using only achieved speed here locks the heading forever when the capsule is stopped.
    const steeringSpeed = want > 0 ? Math.max(b.speed, .8) : b.speed;
    b.heading += b.steer * (steeringSpeed / radius) * FIXED_DT;
    const accel = accelToMs / accelS, change = target > b.speed ? accel * FIXED_DT : (want > 0 ? 9 : 3) * FIXED_DT;
    b.speed += Math.max(-change, Math.min(change, target - b.speed));
    if (want > 0) b.pedal += b.speed * FIXED_DT * 1.8; // cadence follows speed; freewheeling while coasting
    const m = b.speed / speedMs;
    // The attack buttons are disabled while riding; a coasting bicycle with no input keeps its heading.
    const off = { down: false, held: false, up: false };
    const next: InputFrame = { ...frame, move: { x: Math.cos(b.heading) * m, z: Math.sin(b.heading) * m }, left: off, right: { ...off }, selector: 0, interact: !!claimed && frame.interact };
    delete next.attackTarget; delete next.navigation; // the bicycle has its own acceleration and turning model
    return next;
  }
  /** Keeps the parked/ridden bicycle on the rider after physics. */
  postPhysics(): void {
    const bike = this.entity, b = bike?.bicycle, player = this.world.entities.get(1);
    if (!bike || !b || !player) return;
    // QA2-01: the parked bicycle is solid for the rider's capsule (three circles along the frame), so pushes such
    // as the lab blast can never leave the courier standing inside it.
    if (this.world.player) {
      const yaw = bike.transform.yaw, fx = Math.cos(yaw), fz = -Math.sin(yaw);
      this.world.player.locomotion.props = b.mounted ? [] : [-.6, .1, .7].map(along => ({ transform: { x: bike.transform.x + fx * along, z: bike.transform.z + fz * along }, radius: .3 }));
    }
    if (b.mounted) { Object.assign(bike.transform, { x: player.transform.x, y: this.world.districts?.pavingHeight(player.transform.x, player.transform.z) ?? 0, z: player.transform.z, yaw: -b.heading }); player.transform.yaw = bike.transform.yaw; player.riding = bike.id; }
    else delete player.riding;
    // Route around parked frames too: destination clearance alone cannot stop a route
    // crossing a bike and fighting its push-out on the way to an otherwise free click.
    const nav = this.world.infected?.nav, t = bike.transform, key = b.mounted ? 'mounted' : `${t.x}:${t.z}:${t.yaw}`;
    if (nav && key !== this.navPose) {
      const fx = Math.cos(t.yaw), fz = -Math.sin(t.yaw);
      nav.setBlocker(bike.id, { x: t.x + fx * .05, z: t.z + fz * .05, y: t.y + .4, halfX: Math.abs(fx) * .65 + .3, halfZ: Math.abs(fz) * .65 + .3, halfY: .4 }, !b.mounted);
      this.navPose = key;
    }
  }
  /** Full toy-scale box versus Rapier solids, plus wheel/frame margins inside one pavement polygon. */
  clearAt(x: number, z: number, heading: number, mounted = false): boolean {
    if (this.atNoBikeZone({ x, z })) return false;
    const nav = this.world.infected?.nav;
    const fx = Math.cos(heading), fz = Math.sin(heading);
    const offset = mounted ? geometry.mountOffset : 0, ground = this.world.districts?.pavingHeight(x, z) ?? 0;
    const samples = [geometry.minX - geometry.edgeClearance, geometry.rearWheel, 0, geometry.frontWheel, geometry.maxX + geometry.edgeClearance].flatMap(a => [-geometry.halfWidth - geometry.edgeClearance, 0, geometry.halfWidth + geometry.edgeClearance].map(side => ({ x: x + fx * (a + offset) - fz * side, z: z + fz * (a + offset) + fx * side })));
    if (samples.some(p => this.inNoBikeZone(p))) return false;
    if (nav && (!nav.clear(x, z, survivor.radius + .1, false, this.id) || samples.some(p => !nav.clear(p.x, p.z, .05, false, this.id)))) return false;
    const districts = this.world.districts;
    if (districts && (!districts.districts.some(d => d.layout.surfaces.some(s => s.surface === 'tile' && samples.every(p => inside([p.x - d.origin[0], p.z - d.origin[1]], s.polygon)))) || samples.some(p => Math.abs(districts.pavingHeight(p.x, p.z) - ground) > .001))) return false;
    const centre = (geometry.minX + geometry.maxX) / 2 + offset;
    const shape = new RAPIER.Cuboid((geometry.maxX - geometry.minX) / 2 + .03, geometry.height / 2, geometry.halfWidth + .03);
    return !this.world.physics.world!.intersectionWithShape({ x: x + fx * centre, y: ground + .01 + geometry.height / 2, z: z + fz * centre }, { x: 0, y: Math.sin(-heading / 2), z: 0, w: Math.cos(heading / 2) }, shape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!);
  }
  /** Search outward for a level, clear frame; wider rings reach pavement when dismounting in the street. */
  clearSpot(px: number, pz: number, heading: number, radii: readonly number[] = [.9, 1.2, 1.4, 2, 3, 4, 5, 6, 8], mounted = false): Vec2 | null {
    for (const radius of radii) for (let i = 0; i < 8; i++) {
      // left of the rider first, then right, behind, ahead
      const a = heading + Math.PI / 2 + [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4][i];
      const x = px + Math.cos(a) * radius, z = pz + Math.sin(a) * radius;
      if (this.clearAt(x, z, heading, mounted) && !this.inNoBikeZone({ x, z })) return { x, z };
    }
    return null;
  }
  private parkingSpot(x: number, z: number, heading: number, radii: readonly number[] = [.9, 1.2, 1.4, 2, 3, 4, 5, 6, 8]): (Vec2 & { heading: number }) | null {
    for (const radius of radii) for (const direction of [heading, heading + Math.PI / 2]) {
      const spot = this.clearSpot(x, z, direction, [radius]);
      if (spot) return { ...spot, heading: direction };
    }
    return null;
  }
  private dismount(bike: EntitySnapshot, player: EntitySnapshot, at?: Vec2): void {
    const b = bike.bicycle!;
    b.mounted = false; b.speed = 0; b.steer = 0; b.armed = false; b.lockUntil = this.world.tick + 18;
    delete player.riding;
    // Park beside the rider on level pavement; if the local area has no safe spot, retain the last safe parking location.
    const x = at?.x ?? player.transform.x, z = at?.z ?? player.transform.z, spot = this.parkingSpot(x, z, b.heading);
    if (spot) { b.heading = spot.heading; Object.assign(bike.transform, { x: spot.x, z: spot.z, y: this.world.districts?.pavingHeight(spot.x, spot.z) ?? 0, yaw: -b.heading }); this.lastPark = { ...bike.transform }; }
    else if (this.lastPark) { Object.assign(bike.transform, this.lastPark); b.heading = -bike.transform.yaw; }
    this.world.player!.locomotion.reset();
  }
}
