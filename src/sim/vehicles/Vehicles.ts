import * as RAPIER from '@dimforge/rapier3d-compat';
import { vehicleDef } from '../../data/vehicles';
import { survivor } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { VehicleBody } from './VehicleBody';
/** Serialized vehicle component. Native handles live only in Vehicles.cars. */
export interface VehicleState {
  speed: number; forwardSpeed: number; steer: number; braking: boolean; boosting: boolean;
  driver: number | null; attached: number[]; damage: 'normal' | 'smoking' | 'burning' | 'exploded';
  explodeAt: number | null; stuck: boolean; recoveringUntil: number;
}
interface Car { entity: EntitySnapshot; physics: VehicleBody; doorTicks: number; noEnterUntil: number; hits: Map<number, number> }
/** E09 fixed-phase owner; player movement/combat are suspended only while driving. */
export class Vehicles {
  readonly cars = new Map<number, Car>();
  active: number | null = null;
  private readonly exitShape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
  private readonly identity = { x: 0, y: 0, z: 0, w: 1 };
  private readonly position = { x: 0, y: survivor.height / 2 + .005, z: 0 };
  constructor(private readonly world: SimWorld) {}
  spawn(id: string, pos: { x: number; z: number }, yaw = 0): number {
    if (![pos.x, pos.z, yaw].every(Number.isFinite)) throw new RangeError('Vehicle position must be finite');
    const def = vehicleDef(id), physics = new VehicleBody(def, this.world.physics.world!, pos, yaw);
    const entity = this.world.entities.create({ kind: 'vehicle', archetype: id, transform: physics.transform, faction: 'survivor', health: { current: def.hp, max: def.hp }, vehicle: { speed: 0, forwardSpeed: 0, steer: 0, braking: true, boosting: false, driver: null, attached: [], damage: 'normal', explodeAt: null, stuck: false, recoveringUntil: 0 } });
    this.cars.set(entity.id, { entity, physics, doorTicks: 0, noEnterUntil: 0, hits: new Map() }); this.world.spatial.set(entity.id, pos.x, pos.z); return entity.id;
  }
  prePhysics(frame: InputFrame, scheme: Scheme): void {
    const player = this.world.entities.get(1)!;
    for (const car of this.cars.values()) {
      const state = car.entity.vehicle!, drive = car.physics.intent;
      drive.throttle = drive.steer = 0; drive.brake = true; drive.boost = false;
      if (car.entity.health.current > 0 && this.active === car.entity.id) {
        if (frame.right.down) this.exit(car);
        if (this.active === car.entity.id) {
          if (scheme === 'keyboard' || scheme === 'mouse-keyboard') {
            drive.throttle = frame.drive?.throttle ?? frame.move.x;
            drive.steer = frame.drive?.steer ?? -frame.move.z;
            drive.brake = frame.brake ?? false;
          } else {
            const dx = scheme === 'mouse-only' ? (frame.aimPoint?.x ?? player.transform.x) - player.transform.x : frame.move.x;
            const dz = scheme === 'mouse-only' ? (frame.aimPoint?.z ?? player.transform.z) - player.transform.z : frame.move.z;
            const distance = Math.hypot(dx, dz), angle = Math.atan2(-dz, dx);
            const delta = Math.atan2(Math.sin(angle - car.entity.transform.yaw), Math.cos(angle - car.entity.transform.yaw));
            drive.steer = Math.max(-1, Math.min(1, delta * 2));
            drive.throttle = scheme === 'mouse-only' ? Math.min(1, Math.max(0, (distance - 1.2) / 2.8)) : Math.min(1, distance);
            drive.brake = distance < (scheme === 'mouse-only' ? 1.2 : .05) || !!frame.brake;
          }
          drive.boost = frame.left.held;
          if (frame.left.down || (car.physics.def.emergency && this.world.tick % 60 === 0)) this.noise(car);
          if (state.recoveringUntil > this.world.tick) { drive.throttle = -.8; drive.steer = .6; drive.brake = false; }
        }
      } else if (this.active === null && player.health.current > 0 && car.entity.health.current > 0 && this.world.tick >= car.noEnterUntil && car.physics.speed < 1) {
        this.localPoint(car, .2, car.physics.def.width / 2 + .55);
        const near = Math.hypot(player.transform.x - this.position.x, player.transform.z - this.position.z) <= .7;
        const still = Math.hypot(frame.move.x, frame.move.z) < .05;
        car.doorTicks = near && still ? car.doorTicks + 1 : 0;
        if (car.doorTicks >= 36) this.enter(car);
      } else car.doorTicks = 0;
      state.steer = drive.steer * car.physics.def.steering; state.braking = drive.brake; state.boosting = drive.boost;
      car.physics.prePhysics();
    }
  }
  private localPoint(car: Car, x: number, z: number): void {
    const p = car.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    this.position.x = p.x + c * x + s * z; this.position.z = p.z - s * x + c * z;
  }
  private enter(car: Car): void {
    const player = this.world.entities.get(1)!;
    this.active = car.entity.id; car.entity.vehicle!.driver = 1; player.hidden = true;
    this.world.physics.playerCollider!.setEnabled(false);
    this.world.player!.locomotion.reset();
    this.world.events.emit({ type: 'vehicle.entered', tick: this.world.tick, sourceId: car.entity.id, targetId: 1 });
  }
  /** Checks a full survivor capsule against current Rapier geometry, trying both sides. */
  exit(car = this.cars.get(this.active!)!): boolean {
    if (!car || this.active !== car.entity.id) return false;
    for (const side of [1, -1]) for (const x of [.2, -.6, .9]) {
      this.localPoint(car, x, side * (car.physics.def.width / 2 + .55));
      const hit = this.world.physics.world!.intersectionWithShape(this.position, this.identity, this.exitShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!);
      if (hit) continue;
      const player = this.world.entities.get(1)!;
      Object.assign(player.transform, this.position); player.hidden = false; Object.assign(this.world.previousPlayer!, player.transform);
      this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(player.transform);
      this.world.physics.playerCollider!.setEnabled(true); this.world.player!.locomotion.reset(); this.world.spatial.set(1, player.transform.x, player.transform.z);
      this.active = null; car.entity.vehicle!.driver = null; car.noEnterUntil = this.world.tick + 120; car.doorTicks = 0;
      this.world.events.emit({ type: 'vehicle.exited', tick: this.world.tick, sourceId: car.entity.id, targetId: 1 }); return true;
    }
    return false;
  }
  postPhysics(): void {
    for (const car of this.cars.values()) {
      car.physics.postPhysics(); const state = car.entity.vehicle!;
      state.speed = car.physics.speed; state.forwardSpeed = car.physics.forwardSpeed; state.stuck = car.physics.stuck;
      this.world.spatial.set(car.entity.id, car.entity.transform.x, car.entity.transform.z);
      if (this.active === car.entity.id) {
        const player = this.world.entities.get(1)!; Object.assign(this.world.previousPlayer!, player.transform); Object.assign(player.transform, car.entity.transform);
        this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(player.transform); this.world.spatial.set(1, player.transform.x, player.transform.z);
      }
      if (state.stuck && state.recoveringUntil <= this.world.tick && this.active === car.entity.id) {
        state.recoveringUntil = this.world.tick + 90; car.physics.clearStuck();
        this.world.events.emit({ type: 'vehicle.recovering', tick: this.world.tick, sourceId: car.entity.id });
      }
    }
  }
  private noise(car: Car): void {
    const p = car.entity.transform;
    this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId: car.entity.id, actionId: car.entity.archetype, position: { x: p.x, y: p.y, z: p.z }, radius: car.physics.def.emergency ? 60 : 30, loudness: 1, kind: car.physics.def.emergency ? 'siren' : 'horn' });
  }
  dispose(): void { for (const car of this.cars.values()) car.physics.dispose(); this.cars.clear(); this.active = null; }
}
