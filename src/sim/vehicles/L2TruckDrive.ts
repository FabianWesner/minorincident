import { staticCollision } from '../../assets/staticCollision';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { l2, l2TruckPath } from '../../data/l2';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { CoverWall } from '../combat/HitQuery';

export type TruckRideState = { truckId: number; rideS: number; rideV: number };
export type TruckPose = { x: number; z: number; yaw: number };
/** Rectangle SAT; dimensions are the full drawn/physics footprint, never a centre-point distance. */
export function truckBoxOverlap(p: TruckPose, length: number, width: number, q: TruckPose, qLength: number, qWidth: number): boolean {
  if (Math.abs(q.x - p.x) > (length + width + qLength + qWidth) / 2 || Math.abs(q.z - p.z) > (length + width + qLength + qWidth) / 2) return false;
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw), qc = Math.cos(q.yaw), qs = Math.sin(q.yaw), dx = q.x - p.x, dz = q.z - p.z;
  for (const [ax, az] of [[c, -s], [s, c], [qc, -qs], [qs, qc]]) {
    const a = Math.abs(ax * c - az * s) * length / 2 + Math.abs(ax * s + az * c) * width / 2;
    const b = Math.abs(ax * qc - az * qs) * qLength / 2 + Math.abs(ax * qs + az * qc) * qWidth / 2;
    if (Math.abs(dx * ax + dz * az) >= a + b) return false;
  }
  return true;
}
export function truckBodyOverlap(p: TruckPose, length: number, width: number, e: EntitySnapshot, world: SimWorld, margin = 0): boolean {
  const car = world.vehicles?.cars.get(e.id);
  if (car || e.traffic) {
    const boxes = staticCollision[car?.physics.def.asset ?? e.archetype ?? '']?.boxes ?? [];
    const drawnLength = Math.max(car?.physics.def.length ?? 4.2, ...boxes.map(b => Math.max(Math.abs(b.min[0]), Math.abs(b.max[0])) * 2));
    const drawnWidth = Math.max(car?.physics.def.width ?? 1.8, ...boxes.map(b => Math.max(Math.abs(b.min[2]), Math.abs(b.max[2])) * 2));
    return truckBoxOverlap(p, length + margin * 2, width + margin * 2, e.transform, drawnLength, drawnWidth);
  }
  const prop = world.props?.items.find(p => p.entityId === e.id);
  if (prop) {
    const centre = prop.collider.translation();
    return truckBoxOverlap(p, length + margin * 2, width + margin * 2, { x: centre.x, z: centre.z, yaw: e.transform.yaw }, prop.half[0] * 2, prop.half[2] * 2);
  }
  const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = e.transform.x - p.x, dz = e.transform.z - p.z;
  const ox = Math.max(0, Math.abs(dx * c - dz * s) - length / 2), oz = Math.max(0, Math.abs(dx * s + dz * c) - width / 2);
  const radius = (e.civilian?.state === 'finished' ? .85 : e.combat?.radius ?? .35) + margin;
  return ox * ox + oz * oz < radius * radius;
}
export function truckWallOverlap(p: TruckPose, length: number, width: number, w: CoverWall, margin = 0): boolean {
  return truckBoxOverlap(p, length + margin * 2, width + margin * 2, { ...w, yaw: 0 }, w.halfX * 2, w.halfZ * 2);
}

/** Arc-length lookup on the authored right-lane connectors. Position and tangent share the same curve. */
export function truckPoseAt(distance: number) {
  const path = l2TruckPath, at = Math.max(0, Math.min(path.at(-1)!.s, distance));
  let low = 0, high = path.length - 1;
  while (high - low > 1) { const k = (low + high) >>> 1; if (path[k].s < at) low = k; else high = k; }
  const a = path[low], b = path[high], f = (at - a.s) / (b.s - a.s || 1);
  const delta = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, yaw: a.yaw + delta * f, curvature: a.curvature + (b.curvature - a.curvature) * f, limit: Math.min(a.limit, b.limit), section: f < .5 ? a.section : b.section };
}

/** Same driver runs the mission and Scene Lab. Siren yielding is a walk to a kerb; an immovable obstruction holds the truck. */
export class L2TruckDrive {
  readonly length = l2TruckPath.at(-1)!.s;
  constructor(private readonly world: SimWorld, readonly state: TruckRideState) {}
  private yield(e: EntitySnapshot, p: TruckPose): void {
    const c = e.civilian;
    if (!c || c.ally || e.health.current <= 0 || !['calm', 'hide', 'alarmed'].includes(c.state)) return;
    if (c.vehicleYield && c.vehicleYield.until > this.world.tick && Math.hypot(e.transform.x - c.vehicleYield.target.x, e.transform.z - c.vehicleYield.target.z) < 6) return;
    const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw), dx = e.transform.x - p.x, dz = e.transform.z - p.z, along = dx * cs - dz * sn;
    const side = Math.sign(dx * sn + dz * cs) || (e.id % 2 ? 1 : -1);
    for (const k of [side, -side]) for (let offset = 2.8; offset <= 5; offset += .5) {
      const target = { x: p.x + cs * along + sn * k * offset, z: p.z - sn * along + cs * k * offset };
      if (!this.world.infected!.nav.clear(target.x, target.z, .4)) continue;
      const moved = { ...e, transform: { ...e.transform, ...target } };
      // A kerb on the inside of a bend can still be in the rear body sweep: clear the entire connector.
      if (l2TruckPath.some(q => Math.abs(q.x - target.x) < 5 && Math.abs(q.z - target.z) < 5 && truckBodyOverlap(q, 7.4, 2.1, moved, this.world, .5))) continue;
      c.vehicleYield = { target, until: this.world.tick + 600 }; c.path.length = 0; c.goal = -1; return;
    }
  }
  step(): boolean {
    const { world, state: s } = this, car = world.vehicles!.cars.get(s.truckId); if (!car) return false;
    const def = car.physics.def, old = s.rideV, brake = l2.ride.brakeMs2;
    const bodies = [...world.entities.iterate()].filter(e => e.id !== s.truckId && !e.hidden && (e.civilian || e.infected || e.companion || e.vehicle || e.traffic || e.kind === 'physics-prop'));
    const reach = old * old / (2 * brake) + 12;
    const t = car.entity.transform;
    const walls = world.infected!.nav.walls.filter(w => Math.abs(w.x - t.x) < reach + w.halfX + 5 && Math.abs(w.z - t.z) < reach + w.halfZ + 5);
    let gap = Infinity;
    for (let ds = 0; ds <= reach; ds += .2) {
      const p = truckPoseAt(s.rideS + ds);
      for (const e of bodies) if (truckBodyOverlap(p, def.length, def.width, e, world, .4)) {
        this.yield(e, p);
        // Ambient traffic stops for the siren as the engine approaches its crossing.
        if (e.traffic) e.traffic.yieldUntil = world.tick + 120;
        gap = Math.min(gap, ds);
      }
      if (walls.some(w => truckWallOverlap(p, def.length, def.width, w, .12))) gap = Math.min(gap, ds);
    }
    const at = truckPoseAt(s.rideS), remaining = this.length - s.rideS;
    const cap = Math.sqrt(2 * brake * Math.max(0, gap - .6));
    // The baked backward speed envelope brakes before curvature starts, including the full stop at arrival.
    const target = Math.min(at.limit, cap, Math.sqrt(2 * brake * remaining));
    s.rideV += Math.max(-brake / 60, Math.min(l2.ride.accelMs2 / 60, target - old));
    const distance = Math.min(remaining, (old + s.rideV) / 120);
    s.rideS += distance;
    const p = truckPoseAt(s.rideS), y = car.physics.body.translation().y;
    car.physics.body.setNextKinematicTranslation({ x: p.x, y, z: p.z });
    car.physics.body.setNextKinematicRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) });
    Object.assign(car.entity.transform, { x: p.x, z: p.z, yaw: p.yaw });
    const steer = Math.atan(def.wheelbase * p.curvature);
    car.physics.steeringAngle = steer;
    car.physics.intent.steer = steer / def.steering;
    car.entity.vehicle!.speed = s.rideV; car.entity.vehicle!.steer = steer; car.entity.vehicle!.braking = s.rideV < old;
    return remaining < .002 && s.rideV < .12;
  }
  /** Keep the driverless kinematic truck out of the player vehicle controls. */
  prepare(): void {
    const car = this.world.vehicles!.cars.get(this.state.truckId)!;
    car.physics.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    car.noEnterUntil = Number.MAX_SAFE_INTEGER;
    this.world.vehicles!.autopilot.set(this.state.truckId, intent => { intent.steer = car.physics.steeringAngle / car.physics.def.steering; });
  }
}
