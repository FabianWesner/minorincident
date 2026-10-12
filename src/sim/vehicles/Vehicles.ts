import * as RAPIER from '@dimforge/rapier3d-compat';
import { vehicleDef } from '../../data/vehicles';
import { vehicleExplosion } from '../../data/explosions';
import { survivor } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { Bicycle } from './Bicycle';
import { Obstacles } from './Obstacles';
import { VehicleBody } from './VehicleBody';
/** Serialized vehicle component. Native handles live only in Vehicles.cars. */
export interface VehiclePassenger {
  id: number;
  /** Persist transition and civilian routine ownership with the ordinary entity checkpoint. */
  started: number; phase: 'enter' | 'seated' | 'exit'; from: EntitySnapshot['transform'];
  to?: EntitySnapshot['transform']; pauseUntil: number; floorY?: number;
  story?: NonNullable<EntitySnapshot['civilian']>['story'];
}
/** Plain transfer payload: weapons and every living occupant retain their own components/IDs. */
export interface VehicleTransfer { vehicle: EntitySnapshot; occupants: EntitySnapshot[]; infiniteCharges: boolean; tick: number }
export interface VehicleState {
  passengers?: VehiclePassenger[];
  speed: number; forwardSpeed: number; steer: number; braking: boolean; boosting: boolean;
  /** Authored body variant, persisted with the vehicle snapshot. */
  decay?: 'wrecked' | 'burned';
  braced?: boolean; driver: number | null; attached: number[]; damage: 'normal' | 'smoking' | 'burning' | 'exploded';
  explodeAt: number | null; stuck: boolean; recoveringUntil: number;
}
interface Car { entity: EntitySnapshot; physics: VehicleBody; doorTicks: number; noEnterUntil: number; hits: Map<number, number>; crashAt: number }
export interface CarTransition { carId: number; kind: 'enter' | 'exit'; tick: number; side: number; from: { x: number; y: number; z: number; yaw: number }; }
/** E09 fixed-phase owner; player movement/combat are suspended only while driving. */
export class Vehicles {
  readonly cars = new Map<number, Car>();
  /** Short presentation history; input ownership and the hidden simulation driver remain immediate. */
  transition: CarTransition | null = null;
  active: number | null = null;
  /** Debug/Scene Lab driverless cars: sets the drive intent of an unoccupied car before its physics step. */
  readonly autopilot = new Map<number, (intent: import('./VehicleBody').DriveIntent, entity: EntitySnapshot) => void>();
  progressionArmor = 0;
  progressionBoost = 1;
  readonly obstacles: Obstacles;
  /** L1 v2 courier bicycle (lane F); inert until `bicycle.spawn`. */
  readonly bicycle: Bicycle;
  private readonly exitShape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
  private readonly identity = { x: 0, y: 0, z: 0, w: 1 };
  private readonly position = { x: 0, y: survivor.height / 2 + .02, z: 0 };
  constructor(private readonly world: SimWorld) { this.obstacles = new Obstacles(world); this.bicycle = new Bicycle(world); }
  spawn(id: string, pos: { x: number; z: number }, yaw = 0, decay?: VehicleState['decay']): number {
    if (![pos.x, pos.z, yaw].every(Number.isFinite)) throw new RangeError('Vehicle position must be finite');
    const def = vehicleDef(id), physics = new VehicleBody(def, this.world.physics.world!, pos, yaw);
    const entity = this.world.entities.create({ kind: 'vehicle', archetype: id, transform: physics.transform, faction: 'survivor', health: { current: def.hp, max: def.hp }, vehicle: { ...(decay ? { decay } : {}), speed: 0, forwardSpeed: 0, steer: 0, braking: true, boosting: false, driver: null, attached: [], damage: 'normal', explodeAt: null, stuck: false, recoveringUntil: 0 } });
    this.cars.set(entity.id, { entity, physics, doorTicks: 0, noEnterUntil: 0, hits: new Map(), crashAt: -60 }); this.world.spatial.set(entity.id, pos.x, pos.z); return entity.id;
  }
  canInteract(): boolean {
    if (this.active != null) return true;
    if (this.bicycle.canInteract()) return true;
    const player = this.world.entities.get(1);
    if (!player || player.health.current <= 0) return false;
    for (const car of this.cars.values()) {
      if (car.entity.health.current <= 0 || car.physics.speed >= 1 || this.world.tick < car.noEnterUntil) continue;
      this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .55);
      if (Math.hypot(player.transform.x - this.position.x, player.transform.z - this.position.z) <= .7) return true;
    }
    return false;
  }
  prePhysics(frame: InputFrame, scheme: Scheme): void {
    const player = this.world.entities.get(1)!;
    // Cleanup/respawn runs on foot; a dead driver must leave even when both doors are blocked.
    if (player.health.current <= 0 && this.active !== null) this.eject(this.cars.get(this.active)!);
    for (const car of this.cars.values()) {
      if (car.entity.vehicle!.braced) continue;
      const state = car.entity.vehicle!, drive = car.physics.intent;
      car.physics.boostScale = this.progressionBoost;
      car.physics.gripScale = this.world.weather?.modifiers.vehicleGrip ?? 1;
      drive.throttle = drive.steer = 0; drive.brake = true; drive.boost = drive.handbrake = false;
      if (this.active !== car.entity.id) this.autopilot.get(car.entity.id)?.(drive, car.entity);
      if (this.active === car.entity.id && frame.interact) this.exit(car);
      if (car.entity.health.current > 0 && this.active === car.entity.id) {
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
          drive.throttle = scheme === 'mouse-only' ? (frame.left.held ? Math.min(1, Math.max(0, (distance - 1.2) / 2.8)) : 0) : Math.min(1, distance);
          drive.brake = (scheme === 'mouse-only' && !frame.left.held) || distance < (scheme === 'mouse-only' ? 1.2 : .05) || !!frame.brake;
        }
        drive.boost = scheme !== 'mouse-only' && frame.left.held;
        drive.handbrake = frame.handbrake ?? frame.right.held;
        if ((scheme !== 'mouse-only' && frame.left.down) || (car.physics.def.emergency && this.world.tick % 60 === 0)) this.noise(car);
        if (state.recoveringUntil > this.world.tick && !drive.brake) { drive.throttle = -.8; drive.steer = .6; drive.brake = false; }
      } else if (this.active === null && player.health.current > 0 && car.entity.health.current > 0 && this.world.tick >= car.noEnterUntil && car.physics.speed < 1) {
        this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .55);
        const near = Math.hypot(player.transform.x - this.position.x, player.transform.z - this.position.z) <= .7;
        const still = Math.hypot(frame.move.x, frame.move.z) < .05;
        car.doorTicks = near && still ? car.doorTicks + 1 : 0;
        if (near && (car.doorTicks >= 36 || frame.interact)) this.enter(car);
      } else car.doorTicks = 0;
      state.boosting = drive.boost;
      this.impacts(car);
      car.physics.prePhysics();
      state.steer = car.physics.steeringAngle; state.braking = car.physics.braking;
    }
  }
  private localPoint(car: Car, x: number, z: number): void {
    const p = car.entity.transform, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    this.position.x = p.x + c * x + s * z; this.position.z = p.z - s * x + c * z;
  }
  private enter(car: Car): void {
    const player = this.world.entities.get(1)!;
    this.transition = { carId: car.entity.id, kind: 'enter', tick: this.world.tick, side: 1, from: { ...player.transform } };
    this.active = car.entity.id; car.entity.vehicle!.driver = 1; player.hidden = true;
    this.world.physics.playerCollider!.setEnabled(false);
    this.world.player!.locomotion.reset();
    this.world.events.emit({ type: 'vehicle.entered', tick: this.world.tick, sourceId: car.entity.id, targetId: 1 });
  }
  /** Checks a full survivor capsule against current Rapier geometry, trying both sides. */
  exit(car = this.cars.get(this.active!)!): boolean {
    if (!car || this.active !== car.entity.id) return false;
    const out = car.physics.def.width / 2 + .55, along = Math.sqrt(2.5 ** 2 - out ** 2) - .01;
    for (const side of [1, -1]) for (const offset of [0, -.8, .7]) {
      // The long cab anchor still needs an exit inside E09's 2.5 m placement radius.
      this.localPoint(car, Math.max(-along, Math.min(along, car.physics.def.doorX + offset)), side * out);
      const hit = this.world.physics.world!.intersectionWithShape(this.position, this.identity, this.exitShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!);
      if (hit) continue;
      this.transition = { carId: car.entity.id, kind: 'exit', tick: this.world.tick, side, from: { ...car.entity.transform } };
      this.leave(car); return true;
    }
    return false;
  }
  private leave(car: Car): void {
    const player = this.world.entities.get(1)!;
    Object.assign(player.transform, this.position); player.hidden = false; Object.assign(this.world.previousPlayer!, player.transform);
    this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    this.world.physics.playerCollider!.setEnabled(true); this.world.player!.locomotion.reset(); this.world.spatial.set(1, player.transform.x, player.transform.z);
    this.active = null; car.entity.vehicle!.driver = null; car.noEnterUntil = this.world.tick + 120; car.doorTicks = 0;
    this.world.events.emit({ type: 'vehicle.exited', tick: this.world.tick, sourceId: car.entity.id, targetId: 1 });
  }
  private eject(car: Car): void {
    if (this.active !== car.entity.id || this.exit(car)) return;
    // If both doors are boxed in, escape onto the roof before the explosion impulse.
    this.transition = null;
    this.position.x = car.entity.transform.x; this.position.z = car.entity.transform.z;
    this.position.y = car.entity.transform.y + .45 + survivor.height / 2;
    this.leave(car);
    this.position.y = survivor.height / 2 + .02;
  }
  private impacts(car: Car): void {
    const p = car.entity.transform, speed = car.physics.speed, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const velocity = car.physics.body.linvel();
    const extent = car.physics.def.length / 2 + speed / 60;
    // E11-authored light props share their own damage, nav and debris lifecycle.
    const walls = this.world.interactables?.walls;
    for (let index = (walls?.length ?? 0) - 1; index >= 0; index--) {
      const wall = walls![index];
      const entity = wall.entityId === undefined ? undefined : this.world.entities.get(wall.entityId);
      if (!entity?.destructible || entity.health.current <= 0 || !['fence', 'cone', 'barricade', 'trash-can', 'mailbox'].includes(entity.destructible.kind) || speed < 5) continue;
      const dx = entity.transform.x - p.x, dz = entity.transform.z - p.z;
      if (Math.abs(dx * c - dz * s) > extent + Math.abs(c) * wall.halfX + Math.abs(s) * wall.halfZ || Math.abs(dx * s + dz * c) > car.physics.def.width / 2 + Math.abs(s) * wall.halfX + Math.abs(c) * wall.halfZ) continue;
      this.world.hazards!.hit(entity.id, entity.health.max, 'vehicle');
      this.crash(car, speed);
      car.physics.body.setLinvel({ x: velocity.x * .9, y: velocity.y, z: velocity.z * .9 }, true);
      this.world.events.emit({ type: 'vehicle.obstacle-broken', tick: this.world.tick, targetId: entity.id });
    }
    for (const obstacle of this.obstacles.items) {
      if (obstacle.broken) continue;
      const dx = obstacle.entity.transform.x - p.x, dz = obstacle.entity.transform.z - p.z;
      const localX = dx * c - dz * s, localZ = dx * s + dz * c;
      const halfX = Math.abs(c) * obstacle.halfX + Math.abs(s) * obstacle.halfZ;
      const halfZ = Math.abs(s) * obstacle.halfX + Math.abs(c) * obstacle.halfZ;
      if (Math.abs(localX) > extent + halfX || Math.abs(localZ) > car.physics.def.width / 2 + halfZ) continue;
      if (obstacle.light && speed >= 5) {
        this.obstacles.break(obstacle, velocity, this.world.tick);
        this.crash(car, speed);
        car.physics.body.setLinvel({ x: velocity.x * .9, y: velocity.y, z: velocity.z * .9 }, true);
      } else if (!obstacle.light && speed >= 2 && this.world.tick >= (car.hits.get(obstacle.entity.id) ?? 0)) {
        this.crash(car, speed);
        car.hits.set(obstacle.entity.id, this.world.tick + 60);
        car.physics.body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
        car.physics.intent.brake = true;
      }
    }
  }
  /** Hard contacts dent the body even while HP remains above the smoke threshold. */
  private crash(car: Car, speed: number): void {
    if (speed < 2 || this.world.tick - car.crashAt < 60) return;
    if (speed >= 3) car.entity.vehicle!.decay ??= 'wrecked';
    this.damage(car.entity.id, speed * 3 / car.physics.def.ramStrength);
    car.crashAt = this.world.tick;
  }
  /** Shared entry point for crashes, brute retaliation and later weapon/explosion systems. */
  damage(id: number, amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid vehicle damage');
    const car = this.cars.get(id); if (!car) throw new Error(`Unknown vehicle ${id}`);
    car.entity.health.current = Math.max(0, car.entity.health.current - amount * (1 - this.progressionArmor)); this.damageState(car);
  }
  private damageState(car: Car): void {
    const state = car.entity.vehicle!, ratio = car.entity.health.current / car.entity.health.max;
    if (state.damage === 'exploded') return;
    if (ratio < .15) state.decay = 'burned';
    else if (ratio < .4) state.decay ??= 'wrecked';
    if (ratio < .4 && state.damage === 'normal') { state.damage = 'smoking'; this.world.events.emit({ type: 'vehicle.smoking', tick: this.world.tick, sourceId: car.entity.id }); }
    if (ratio < .15 && state.damage === 'smoking') { state.damage = 'burning'; this.world.events.emit({ type: 'vehicle.burning', tick: this.world.tick, sourceId: car.entity.id }); }
    if (ratio === 0 && state.explodeAt === null) state.explodeAt = this.world.tick + 180;
    if (state.explodeAt !== null && this.world.tick >= state.explodeAt) {
      state.damage = 'exploded';
      this.eject(car);
      this.world.events.emit({ type: 'vehicle.exploded', tick: this.world.tick, sourceId: car.entity.id });
      // E27 large blast: the wreck jumps (its own delayed upward impulse), doors/hood detach, curve damage and fires.
      this.world.explosions?.blast(vehicleExplosion, car.entity.transform, { sourceId: car.entity.id });
    }
  }
  private release(car: Car): void {
    const state = car.entity.vehicle!, p = car.entity.transform;
    for (const id of state.attached) {
      const target = this.world.entities.get(id);
      if (target) { delete target.attachedTo; const side = id % 2 ? 1 : -1; target.transform.x = p.x + Math.sin(p.yaw) * side * 2; target.transform.z = p.z + Math.cos(p.yaw) * side * 2; this.world.spatial.set(id, target.transform.x, target.transform.z); }
      this.world.events.emit({ type: 'vehicle.shaken', tick: this.world.tick, sourceId: car.entity.id, targetId: id });
    }
    state.attached.length = 0;
  }
  private infected(car: Car): void {
    // Passenger rides resolve their swept contacts in the scripted driver, including at low speed.
    if (car.physics.body.isKinematic() && car.physics.def.id === 'vehicle.fire-engine') return;
    const state = car.entity.vehicle!, p = car.entity.transform, speed = car.physics.speed;
    if (car.entity.health.current <= 0) { this.release(car); return; }
    if (speed > 8 || Math.abs(car.physics.intent.steer) > .8) this.release(car);
    for (const target of this.world.entities.iterate()) {
      if (target.kind !== 'infected' || target.health.current <= 0 || target.hidden || target.attachedTo) continue;
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z, distance = Math.hypot(dx, dz);
      if (speed < 3 && distance <= 1.5 && state.attached.length < 4 && Math.abs(car.physics.intent.steer) <= .8) {
        state.attached.push(target.id); target.attachedTo = car.entity.id;
        this.world.events.emit({ type: 'vehicle.grabbed', tick: this.world.tick, sourceId: car.entity.id, targetId: target.id }); continue;
      }
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), radius = target.combat?.radius ?? .4;
      if (speed < 4 || Math.abs(dx * c - dz * s) > car.physics.def.length / 2 + radius + speed / 60 || Math.abs(dx * s + dz * c) > car.physics.def.width / 2 + radius || this.world.tick < (car.hits.get(target.id) ?? 0)) continue;
      car.hits.set(target.id, this.world.tick + 60);
      this.world.combat?.damage.apply({ attackId: this.world.tick, actionId: car.entity.archetype, sourceId: car.entity.id, targetId: target.id, origin: p, direction: { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, base: speed * 30 * car.physics.def.ramStrength, multiplier: 1, type: 'vehicle', knockback: target.archetype === 'infected.brute' ? 3 : 1, stagger: .5 });
      if (target.archetype === 'infected.brute') this.damage(car.entity.id, target.ramDamage ?? 40);
    }
    for (const id of state.attached) { const target = this.world.entities.get(id); if (target) { Object.assign(target.transform, p); const side = id % 2 ? 1 : -1; target.transform.x += Math.sin(p.yaw) * side * car.physics.def.width / 2; target.transform.z += Math.cos(p.yaw) * side * car.physics.def.width / 2; this.world.spatial.set(id, target.transform.x, target.transform.z); } }
  }
  postPhysics(): void {
    this.bicycle.postPhysics();
    for (const car of this.cars.values()) {
      const beforeSpeed = car.physics.speed;
      car.physics.postPhysics();
      if (beforeSpeed >= 3 && this.world.tick - car.crashAt >= 60) {
        this.world.physics.world!.contactPairsWith(car.physics.collider, collider => {
          let impulse = 0;
          this.world.physics.world!.contactPair(car.physics.collider, collider, manifold => {
            // Ground support and resting contacts must not dent the body.
            if (Math.abs(manifold.normal().y) > .7) return;
            for (let i = 0; i < manifold.numContacts(); i++) impulse += manifold.contactImpulse(i);
          });
          if (impulse / car.physics.def.mass < 2) return;
          this.crash(car, beforeSpeed);
          // The struck parked car also takes the impact, despite having no incoming speed.
          for (const other of this.cars.values()) if (other.physics.collider.handle === collider.handle) this.crash(other, beforeSpeed);
        });
      }
      const state = car.entity.vehicle!;
      state.speed = car.physics.speed; state.forwardSpeed = car.physics.forwardSpeed; state.stuck = car.physics.stuck;
      this.world.spatial.set(car.entity.id, car.entity.transform.x, car.entity.transform.z);
      if (this.active === car.entity.id) {
        const player = this.world.entities.get(1)!; Object.assign(this.world.previousPlayer!, player.transform); Object.assign(player.transform, car.entity.transform);
        this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(player.transform); this.world.spatial.set(1, player.transform.x, player.transform.z);
      }
      this.updatePassengers(car); this.infected(car); this.damageState(car);
      if (this.active === car.entity.id && car.entity.health.current > 0 && car.physics.recoverFlip()) {
        state.recoveringUntil = 0;
        this.world.events.emit({ type: 'vehicle.recovering', tick: this.world.tick, sourceId: car.entity.id });
      } else if (state.stuck && state.recoveringUntil <= this.world.tick && this.active === car.entity.id) {
        state.recoveringUntil = this.world.tick + 90; car.physics.clearStuck();
        this.world.events.emit({ type: 'vehicle.recovering', tick: this.world.tick, sourceId: car.entity.id });
      }
    }
    this.obstacles.update(this.world.tick);
  }
  /** Boarding uses the same doorway as the driver, with no visual seat-count limit. */
  boardPassenger(carId: number, actorId: number): boolean {
    const car = this.cars.get(carId), actor = this.world.entities.get(actorId);
    if (!car?.physics.def.transport || !actor?.civilian || actor.health.current <= 0 || actor.infected || actorId === 1 || car.entity.health.current <= 0 || car.physics.speed >= 1 || actor.passengerOf !== undefined) return false;
    this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .55);
    if (Math.hypot(actor.transform.x - this.position.x, actor.transform.z - this.position.z) > .7) return false;
    const c = actor.civilian;
    const passenger: VehiclePassenger = { id: actorId, phase: 'enter', started: this.world.tick, from: { ...actor.transform }, pauseUntil: c.pauseUntil, floorY: c.floorY, story: c.story ? { ...c.story } : c.story };
    (car.entity.vehicle!.passengers ??= []).push(passenger);
    actor.passengerOf = carId; c.pauseUntil = Number.MAX_SAFE_INTEGER; c.path.length = 0;
    return true;
  }
  /** Escape lanes provide their complete group, including losses; no kill-count condition. */
  groupBoarded(carId: number, roster: readonly number[]): boolean {
    const car = this.cars.get(carId);
    if (!car || car.entity.vehicle!.driver !== 1) return false;
    return roster.every(id => {
      const actor = this.world.entities.get(id);
      return !!actor && (actor.health.current <= 0 || !!actor.infected || car.entity.vehicle!.passengers?.some(p => p.id === id && p.phase === 'seated') === true);
    });
  }
  disembarkPassenger(carId: number, actorId: number): boolean {
    const car = this.cars.get(carId), passenger = car?.entity.vehicle!.passengers?.find(p => p.id === actorId), actor = this.world.entities.get(actorId);
    if (!car || !passenger || !actor || passenger.phase !== 'seated') return false;
    for (const side of [1, -1]) for (let offset = 0; offset <= 4; offset++) {
      this.localPoint(car, car.physics.def.doorX - offset * .8, side * (car.physics.def.width / 2 + .65));
      const nav = this.world.infected?.nav;
      if (nav && !nav.clear(this.position.x, this.position.z, survivor.radius)) continue;
      if ([...this.world.entities.iterate()].some(e => e.id !== actorId && !e.hidden && e.health.current > 0 && (e.civilian || e.survivor) && Math.hypot(e.transform.x - this.position.x, e.transform.z - this.position.z) < .8)) continue;
      if (this.world.physics.world!.intersectionWithShape(this.position, this.identity, this.exitShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!)) continue;
      passenger.phase = 'exit'; passenger.started = this.world.tick;
      passenger.from = { ...actor.transform }; passenger.to = { ...this.position, yaw: car.entity.transform.yaw };
      return true;
    }
    return false;
  }
  private updatePassengers(car: Car): void {
    const passengers = car.entity.vehicle!.passengers;
    if (!passengers) return;
    for (let i = passengers.length - 1; i >= 0; i--) {
      const p = passengers[i], actor = this.world.entities.get(p.id);
      if (!actor) continue;
      const elapsed = this.world.tick - p.started, c = actor.civilian!;
      if (p.phase === 'seated') {
        Object.assign(actor.transform, car.entity.transform); actor.hidden = true; this.world.spatial.delete(actor.id); continue;
      }
      const entering = p.phase === 'enter';
      this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .05);
      const target = entering ? { ...this.position, y: car.physics.def.stepHeight + .7 } : p.to!;
      const start = entering ? p.from : { ...this.position, y: car.physics.def.stepHeight + .7, yaw: car.entity.transform.yaw };
      const t = Math.max(0, Math.min(1, (elapsed - 12) / 30)), weight = t * t * (3 - 2 * t);
      actor.transform.x = start.x + (target.x - start.x) * weight;
      actor.transform.z = start.z + (target.z - start.z) * weight;
      actor.transform.y = start.y + (target.y - start.y) * weight;
      actor.transform.yaw = car.entity.transform.yaw + (entering ? Math.PI / 2 : -Math.PI / 2);
      actor.hidden = entering ? elapsed >= 42 : elapsed < 12;
      c.floorY = actor.transform.y - .7;
      c.story = { clip: entering ? 'npc-sit-down' : 'npc-stand-up', start: p.started };
      if (actor.hidden) this.world.spatial.delete(actor.id); else this.world.spatial.set(actor.id, actor.transform.x, actor.transform.z);
      if (elapsed < 60) continue;
      if (entering) {
        p.phase = 'seated'; actor.hidden = true;
        this.world.events.emit({ type: 'vehicle.entered', tick: this.world.tick, sourceId: car.entity.id, targetId: actor.id, role: 'passenger' });
      } else {
        actor.hidden = false; delete actor.passengerOf; c.pauseUntil = p.pauseUntil; c.floorY = p.floorY; c.story = p.story ?? null;
        passengers.splice(i, 1);
        this.world.events.emit({ type: 'vehicle.exited', tick: this.world.tick, sourceId: car.entity.id, targetId: actor.id, role: 'passenger' });
      }
    }
  }
  /** Call only after the complete living group is seated; copy before replacing the level. */
  transfer(carId: number): VehicleTransfer {
    const car = this.cars.get(carId);
    if (!car?.physics.def.transport || car.entity.vehicle!.driver !== 1 || car.entity.vehicle!.passengers?.some(p => p.phase !== 'seated')) throw new Error('Transport is not ready to depart');
    const ids = [1, ...(car.entity.vehicle!.passengers ?? []).map(p => p.id)];
    return structuredClone({ tick: this.world.tick, infiniteCharges: this.world.combat?.runner.infiniteCharges ?? false, vehicle: car.entity, occupants: ids.map(id => this.world.entities.get(id)!).filter(e => e.health.current > 0 && !e.infected) });
  }
  /** Destination level calls after its normal setup, before any entities can claim these IDs. */
  restoreTransfer(transfer: VehicleTransfer, position: { x: number; z: number }, yaw = 0): number {
    const payload = structuredClone(transfer), vehicle = payload.vehicle;
    if (!vehicle.vehicle || vehicle.vehicle.driver !== 1 || !vehicleDef(vehicle.archetype).transport || !payload.occupants.some(e => e.id === 1)) throw new Error('Invalid transport transfer');
    for (const entity of [vehicle, ...payload.occupants]) if (entity.id !== 1 && this.world.entities.get(entity.id)) throw new Error(`Transport identity collision: ${entity.id}`);
    const delta = this.world.tick - payload.tick;
    for (const actor of payload.occupants) {
      const c = actor.civilian;
      if (c) {
        c.entered += delta;
        for (const key of ['until', 'pauseUntil', 'knockedUntil', 'activityUntil', 'activityStarted'] as const) if (c[key] && c[key] !== Number.MAX_SAFE_INTEGER) c[key]! += delta;
        if (c.story) c.story.start += delta;
        if (c.survivor) { c.survivor.foundAt += delta; if (c.survivor.waitAt) c.survivor.waitAt += delta; }
      }
      if (actor.infection) { actor.infection.startedTick += delta; actor.infection.endsTick += delta; }
      if (actor.weapons) for (const side of [actor.weapons.LEFT, actor.weapons.RIGHT]) {
        if (side.swapUntil) side.swapUntil += delta;
        for (const slot of side.rack) for (const key of ['nextCharge', 'reloadUntil', 'readyAt'] as const) if (slot[key]) slot[key] += delta;
      }
    }
    for (const passenger of vehicle.vehicle.passengers ?? []) { passenger.started += delta; passenger.pauseUntil += delta; if (passenger.story) passenger.story.start += delta; }
    if (vehicle.vehicle.explodeAt !== null) vehicle.vehicle.explodeAt += delta;
    if (vehicle.vehicle.recoveringUntil) vehicle.vehicle.recoveringUntil += delta;
    vehicle.vehicle.attached = [];
    vehicle.transform.x = position.x; vehicle.transform.z = position.z; vehicle.transform.yaw = yaw;
    for (const actor of payload.occupants) {
      if (actor.id === 1) Object.assign(this.world.entities.get(1)!, actor);
      else this.world.entities.replace(actor);
    }
    this.world.entities.replace(vehicle); this.rebuild();
    for (const actor of payload.occupants) {
      const live = this.world.entities.get(actor.id)!; Object.assign(live.transform, vehicle.transform); live.hidden = true; this.world.spatial.delete(live.id);
    }
    const player = this.world.entities.get(1)!;
    if (player.weapons && this.world.combat) {
      const saved = player.weapons;
      this.world.combat.setLoadout(saved.LEFT.rack.map(s => s.id), saved.RIGHT.rack.map(s => s.id));
      Object.assign(this.world.combat.runner.loadout.state, saved);
      this.world.combat.runner.infiniteCharges = payload.infiniteCharges;
    }
    this.world.player!.locomotion.reset(); player.survivor!.velocity = this.world.player!.locomotion.velocity; player.locomotion = this.world.player!.locomotion.response;
    Object.assign(this.world.previousPlayer!, player.transform);
    this.world.physics.playerBody!.setTranslation(player.transform, true); this.world.physics.playerBody!.setNextKinematicTranslation(player.transform);
    return vehicle.id;
  }
  private noise(car: Car): void {
    const p = car.entity.transform;
    const radius = car.physics.def.emergency ? 60 : 30, kind = car.physics.def.emergency ? 'siren' : 'horn';
    if (this.world.combat) { this.world.combat.effects.noise(p, radius, car.entity.archetype, car.entity.id, kind); return; }
    this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId: car.entity.id, actionId: car.entity.archetype, position: { x: p.x, y: p.y, z: p.z }, radius, loudness: 1, kind });
  }
  /** Native vehicle resources are rebuilt after E12 entity restore or world replacement. */
  rebuild(worldReset = false, delta = 0): void {
    this.obstacles.rebuild(worldReset);
    if (!worldReset) for (const car of this.cars.values()) car.physics.dispose();
    this.cars.clear(); this.active = null; this.transition = null;
    for (const entity of this.world.entities.iterate()) {
      if (!entity.vehicle) continue;
      const state = entity.vehicle;
      for (const passenger of state.passengers ?? []) { passenger.started += delta; passenger.pauseUntil += delta; if (passenger.story) passenger.story.start += delta; }
      const physics = new VehicleBody(vehicleDef(entity.archetype), this.world.physics.world!, entity.transform, entity.transform.yaw);
      Object.assign(physics.transform, entity.transform); Object.assign(physics.previous, entity.transform); entity.transform = physics.transform;
      physics.body.setTranslation(entity.transform, true);
      physics.speed = state.speed; physics.forwardSpeed = state.forwardSpeed;
      physics.body.setLinvel({ x: Math.cos(entity.transform.yaw) * state.forwardSpeed, y: 0, z: -Math.sin(entity.transform.yaw) * state.forwardSpeed }, true);
      this.cars.set(entity.id, { entity, physics, doorTicks: 0, noEnterUntil: this.world.tick, hits: new Map(), crashAt: this.world.tick });
      if (state.driver === 1) this.active = entity.id;
    }
    this.world.entities.get(1)!.hidden = this.active !== null;
    this.world.physics.playerCollider!.setEnabled(this.active === null);
  }
  dispose(): void { this.obstacles.dispose(); for (const car of this.cars.values()) car.physics.dispose(); this.cars.clear(); this.active = null; this.transition = null; }
}
