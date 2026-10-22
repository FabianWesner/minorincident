import { surfaceUnder } from '../../levels/districts/decorationSurface';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { apcDurability, apcFloor, vehicleBoardingTicks, vehicleDef } from '../../data/vehicles';
import { vehicleExplosion } from '../../data/explosions';
import { survivor } from '../../data/survivor';
import type { InputFrame, Scheme } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import { Status } from '../combat/Status';
import { Bicycle } from './Bicycle';
import { Obstacles } from './Obstacles';
import { VehicleBody } from './VehicleBody';
import { emitEngine } from './ConvoySound';
/** Serialized vehicle component. Native handles live only in Vehicles.cars. */
export interface VehiclePassenger {
  id: number; seat?: number;
  /** Persist transition and civilian routine ownership with the ordinary entity checkpoint. */
  started: number; phase: 'enter' | 'seated' | 'exit'; from: EntitySnapshot['transform'];
  to?: EntitySnapshot['transform']; side?: number; pauseUntil: number; floorY?: number;
  story?: NonNullable<EntitySnapshot['civilian']>['story'];
}
/** Plain transfer payload: weapons and every living occupant retain their own components/IDs. */
export interface VehicleTransfer { vehicle: EntitySnapshot; occupants: EntitySnapshot[]; infiniteCharges: boolean; tick: number }
/** Entity-owned overlap and attack timers survive ordinary checkpoint rebuilds. */
export interface APCContact {
  contactId: number | null; separatedAt: number | null;
  windupAt: number | null; attackId: number | null; cooldownUntil: number;
}
/** Obstacle/wreck contact onset ledger entry (one per logical obstacle, whatever its collider count). */
export interface APCObstacleContact { contactId: number | null; separatedAt: number | null }
/** Authored wreck: several colliders, one logical obstacle id (an entity id or any caller-owned unique number). */
export interface WreckBox { x: number; z: number; halfX: number; halfZ: number }
export interface VehicleState {
  apcContacts?: { sequence: number; infected: Record<number, APCContact>; obstacles?: Record<number, APCObstacleContact> };
  /** L9 mission policy: durability clamps to 0 but the vehicle stays driveable at a capped speed, cannot be exited and is never destroyed by E09. Persisted with the entity. */
  floor?: boolean;
  scripted?: boolean;
  /** Cumulative damage stage (0 none, 1 <=75%, 2 <=50%, 3 <=25%, 4 = 0%); persisted so a reload restores it without replaying cues. */
  stage?: number;
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
  /** Authored multi-collider wrecks by logical id; level setup re-registers them, they are not part of the save. */
  readonly wrecks = new Map<number, readonly WreckBox[]>();
  /** L1 v2 courier bicycle (lane F); inert until `bicycle.spawn`. */
  readonly bicycle: Bicycle;
  private readonly infectedNeighbors: number[] = [];
  private readonly hullAttackers: EntitySnapshot[] = [];
  private readonly exitShape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
  private readonly identity = { x: 0, y: 0, z: 0, w: 1 };
  private readonly position = { x: 0, y: survivor.height / 2 + .02, z: 0 };
  constructor(private readonly world: SimWorld) { this.obstacles = new Obstacles(world); this.bicycle = new Bicycle(world); }
  spawn(id: string, pos: { x: number; z: number }, yaw = 0, decay?: VehicleState['decay']): number {
    if (![pos.x, pos.z, yaw].every(Number.isFinite)) throw new RangeError('Vehicle position must be finite');
    const def = vehicleDef(id), physics = new VehicleBody(def, this.world.physics.world!, pos, yaw);
    const entity = this.world.entities.create({ kind: 'vehicle', archetype: id, transform: physics.transform, faction: 'survivor', health: { current: def.hp, max: def.hp }, vehicle: { ...(decay ? { decay } : {}), speed: 0, forwardSpeed: 0, steer: 0, braking: true, boosting: false, driver: null, attached: [], damage: 'normal', explodeAt: null, stuck: false, recoveringUntil: 0 } });
    this.cars.set(entity.id, { entity, physics, doorTicks: 0, noEnterUntil: 0, hits: new Map(), crashAt: -60 }); this.world.spatial.set(entity.id, pos.x, pos.z); this.world.solids.register(entity); return entity.id;
  }
  /** A car can be driven while it has durability, or at the L9 floor. */
  private operable(car: Car): boolean { return car.entity.vehicle!.damage !== 'exploded' && (car.entity.health.current > 0 || !!car.entity.vehicle!.floor); }
  /** L9 mission vehicle: 0 HP is a capped-speed floor, not a breakdown. Re-applying after a checkpoint restore replays no cue. */
  setFloorPolicy(id: number, on = true): void {
    const car = this.cars.get(id); if (!car) throw new Error(`Unknown vehicle ${id}`);
    const state = car.entity.vehicle!; state.floor = on || undefined;
    if (on) { state.stage = this.stageOf(car); this.floorAppearance(car); }
    car.physics.speedCap = this.speedShare(car); car.physics.overspeedDamp = apcFloor.overspeedDamp;
  }
  /** L9 terrain cap and damage floor compose once, including damage/checkpoint rebuilds. */
  private speedShare(car: Car): number {
    let share = car.entity.vehicle!.floor && car.entity.health.current <= 0 ? apcFloor.speedShare : 1;
    if (car.entity.vehicle!.floor && this.world.scenario === 'L9') {
      const district = this.world.districts?.districts.find(d => d.id === 'D-CROSSING');
      if (district) {
        const p = car.entity.transform;
        if (surfaceUnder(district.layout, p.x - district.origin[0], p.z - district.origin[1]) !== 'asphalt') share *= 12 / car.physics.def.topSpeed;
      }
    }
    return share;
  }
  /** Stage boundaries are inclusive, in percent of max durability. */
  private stageOf(car: Car): number {
    const ratio = car.entity.health.current / car.entity.health.max;
    let stage = 0; for (const limit of apcFloor.stages) if (ratio <= limit + 1e-9) stage++;
    return stage;
  }
  private floorAppearance(car: Car): void {
    const state = car.entity.vehicle!;
    // Existing smoke puffs stand in for the heavy-smoke stage; fire and explosions never run in the floor policy.
    state.damage = (state.stage ?? 0) >= 3 ? 'smoking' : 'normal'; state.explodeAt = null;
  }
  canInteract(): boolean {
    if (this.active != null) return !this.cars.get(this.active)?.entity.vehicle?.floor;
    if (this.bicycle.canInteract()) return true;
    const player = this.world.entities.get(1);
    if (!player || player.health.current <= 0) return false;
    for (const car of this.cars.values()) {
      if (!this.operable(car) || car.physics.speed >= 1 || this.world.tick < car.noEnterUntil) continue;
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
      if (car.entity.vehicle!.braced || car.entity.vehicle!.scripted) continue;
      const state = car.entity.vehicle!, drive = car.physics.intent;
      car.physics.boostScale = this.progressionBoost;
      car.physics.gripScale = this.world.weather?.modifiers.vehicleGrip ?? 1;
      drive.throttle = drive.steer = 0; drive.brake = true; drive.boost = drive.handbrake = false;
      if (this.active !== car.entity.id) this.autopilot.get(car.entity.id)?.(drive, car.entity);
      // The floor vehicle has no voluntary exit: the interact input is ignored until the scripted crash.
      if (this.active === car.entity.id && frame.interact && !state.floor) this.exit(car);
      const zoo=this.world.missions?.l8;
      const waitingForBoarding=zoo?.state.carId===car.entity.id&&!zoo.canDrive();
      if (this.operable(car) && this.active === car.entity.id && !waitingForBoarding) {
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
        drive.boost = car.physics.def.id !== 'vehicle.military-apc' && scheme !== 'mouse-only' && frame.left.held;
        drive.handbrake = frame.handbrake ?? frame.right.held;
        if ((scheme !== 'mouse-only' && frame.left.down) || (car.physics.def.emergency && this.world.tick % 60 === 0)) this.noise(car);
        if (state.recoveringUntil > this.world.tick && !drive.brake) { drive.throttle = -.8; drive.steer = .6; drive.brake = false; }
      } else if (this.active === null && player.health.current > 0 && this.operable(car) && this.world.tick >= car.noEnterUntil && car.physics.speed < 1) {
        this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .55);
        const near = Math.hypot(player.transform.x - this.position.x, player.transform.z - this.position.z) <= .7;
        const still = Math.hypot(frame.move.x, frame.move.z) < .05;
        car.doorTicks = near && still ? car.doorTicks + 1 : 0;
        if (near && (car.doorTicks >= 36 || frame.interact)) this.enter(car);
      } else car.doorTicks = 0;
      state.boosting = drive.boost;
      car.physics.speedCap = this.speedShare(car);
      if (state.floor) this.floorContacts(car);
      this.impacts(car);
      car.physics.prePhysics();
      state.steer = car.physics.steeringAngle; state.braking = car.physics.braking;
    }
  }
  /** Mission-owned fall: suppress ordinary controls/contact destruction and retain the existing vehicle view. */
  scriptPose(id: number, pose: EntitySnapshot['transform']): void {
    const car = this.cars.get(id)!; car.entity.vehicle!.scripted = true;
    const b = car.physics;
    b.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    b.collider.setEnabled(false);
    Object.assign(b.previous, b.transform); Object.assign(b.previousRotation, b.rotation);
    Object.assign(b.transform, pose);
    Object.assign(b.rotation, { x: 0, y: Math.sin(pose.yaw / 2), z: 0, w: Math.cos(pose.yaw / 2) });
    b.body.setTranslation(pose, true); b.body.setNextKinematicTranslation(pose);
    b.body.setRotation(b.rotation, true); b.body.setNextKinematicRotation(b.rotation);
    b.speed = b.forwardSpeed = 0; car.entity.vehicle!.speed = car.entity.vehicle!.forwardSpeed = 0;
    this.world.spatial.set(id, pose.x, pose.z);
    if (this.active === id) {
      const player = this.world.entities.get(1)!; Object.assign(player.transform, pose);
      this.world.physics.playerBody!.setTranslation(pose, true); this.world.physics.playerBody!.setNextKinematicTranslation(pose);
    }
  }
  /** Authored finale only: safe placement was validated by the mission before detaching the driver. */
  destroyScripted(id: number, safe: EntitySnapshot['transform']): void {
    const car = this.cars.get(id)!, state = car.entity.vehicle!;
    if (state.damage === 'exploded') return;
    Object.assign(this.position, safe); this.transition = null;
    if (this.active === id) this.leave(car);
    state.floor = false; state.damage = 'exploded'; state.decay = 'wrecked'; state.explodeAt = null;
    car.entity.health.current = 0;
    this.world.events.emit({ type: 'vehicle.exploded', tick: this.world.tick, sourceId: id });
    this.world.explosions?.blast(vehicleExplosion, car.entity.transform, { sourceId: id, damage: false, fires: false, height: car.entity.transform.y - (car.physics.def.suspension + car.physics.def.wheelRadius + .15) + .7 });
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
    if (!car || this.active !== car.entity.id || car.entity.vehicle!.floor && this.world.entities.get(1)!.health.current > 0) return false;
    const out = car.physics.def.width / 2 + .55, along = Math.sqrt(2.5 ** 2 - out ** 2) - .01;
    for (const side of [1, -1]) for (const offset of [0, -.8, .7]) {
      // The long cab anchor still needs an exit inside E09's 2.5 m placement radius.
      this.localPoint(car, Math.max(-along, Math.min(along, car.physics.def.doorX + offset)), side * out);
      const hit = this.world.physics.world!.intersectionWithShape(this.position, this.identity, this.exitShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!);
      if (hit || !this.world.solids.clear(this.position, survivor.radius, 1)) continue;
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
    // Floor policy: contacts are billed once per logical obstacle (floorContacts), never by speed, and never swap the hull for the wreck shell.
    if (car.entity.vehicle!.floor) { car.crashAt = this.world.tick; return; }
    if (speed >= 3) car.entity.vehicle!.decay ??= 'wrecked';
    this.damage(car.entity.id, speed * 3 / car.physics.def.ramStrength);
    car.crashAt = this.world.tick;
  }
  /** Shared entry point for crashes, brute retaliation and later weapon/explosion systems. */
  damage(id: number, amount: number): void {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid vehicle damage');
    const car = this.cars.get(id); if (!car) throw new Error(`Unknown vehicle ${id}`);
    car.entity.health.current = Math.max(0, car.entity.health.current - amount * (car.physics.def.id === 'vehicle.military-apc' ? 1 : 1 - this.progressionArmor)); this.damageState(car);
  }
  private damageState(car: Car): void {
    const state = car.entity.vehicle!, ratio = car.entity.health.current / car.entity.health.max;
    if (state.floor) {
      // Mission floor: cumulative stages only, each announced once; no smoking/burning/explosion path.
      const stage = this.stageOf(car);
      for (let next = (state.stage ?? 0) + 1; next <= stage; next++) this.world.events.emit({ type: 'vehicle.damage-stage', tick: this.world.tick, sourceId: car.entity.id, stage: next });
      state.stage = Math.max(state.stage ?? 0, stage); this.floorAppearance(car);
      car.physics.speedCap = this.speedShare(car);
      return;
    }
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
    if (car.physics.def.id === 'vehicle.military-apc') { this.apcInfected(car); return; }
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
  /** E31: every active infected contact costs durability, with independent aware hull attacks. */
  private apcInfected(car: Car): void {
    if (!this.operable(car)) return;
    const tuning = apcDurability, tick = this.world.tick, p = car.entity.transform, speed = car.physics.speed;
    const ledger = car.entity.vehicle!.apcContacts ??= { sequence: 0, infected: {} };
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    // Spatial broad phase stays local even when the crossing owns many distant entities.
    this.world.spatial.query({ x: p.x, z: p.z, r: Math.hypot(car.physics.def.length / 2, car.physics.def.width / 2) + tuning.surroundReach + speed / 60 }, this.infectedNeighbors);
    this.hullAttackers.length = 0;
    let quadrants = 0;
    for (const id of this.infectedNeighbors) {
      if (!this.operable(car)) break;
      const target = this.world.entities.get(id)!;
      if (target.kind !== 'infected' || target.hidden || target.infected?.hidden || (target.health.current <= 0 && (target.infected?.recoverAt ?? -1) < 0)) continue;
      const distance = car.physics.hullDistance(target.transform.x, target.transform.z), radius = target.combat?.radius ?? .4;
      let contact = ledger.infected[id];
      // Shared hull admission leaves a millimetre of skin at an exact contact.
      if (distance <= radius + .002) {
        contact ??= ledger.infected[id] = { contactId: null, separatedAt: null, windupAt: null, attackId: null, cooldownUntil: 0 };
        contact.separatedAt = null;
        if (contact.contactId === null) {
          contact.contactId = ++ledger.sequence;
          this.apcHit(car, target, 'contact', contact.contactId, null);
        }
        // E09 mass damage is independent of contact billing, so accelerating through an overlap still rams.
        if (speed >= 4 && this.operable(car) && tick >= (car.hits.get(id) ?? 0)) {
          car.hits.set(id, tick + 60);
          this.world.combat?.damage.apply({ attackId: contact.contactId!, actionId: car.entity.archetype, sourceId: car.entity.id, targetId: id, origin: p, direction: { x: c, z: -s }, base: speed * 30 * car.physics.def.ramStrength, multiplier: 1, type: 'vehicle', knockback: target.archetype === 'infected.brute' ? 3 : 1, stagger: .5 });
        }
      }
      const brain = target.infected;
      const aware = brain && ['alerted', 'chase', 'attack', 'attracted', 'bite'].includes(brain.state);
      if (target.health.current <= 0 || !aware || Status.stunned(target, tick) || distance > tuning.surroundReach || !this.world.combat?.query.visible(target.transform, p)) continue;
      this.hullAttackers.push(target);
      const dx = target.transform.x - p.x, dz = target.transform.z - p.z;
      quadrants |= 1 << ((dx * c - dz * s >= 0 ? 1 : 0) + (dx * s + dz * c >= 0 ? 2 : 0));
    }
    let quadrantCount = 0;
    for (let bits = quadrants; bits; bits >>= 1) quadrantCount += bits & 1;
    const attackable = speed < tuning.stoppedSpeed || (this.hullAttackers.length >= tuning.surroundCount && quadrantCount >= tuning.surroundQuadrants);
    // Re-arm only after a full separation window, including targets outside the broad phase.
    for (const key of Object.keys(ledger.infected)) {
      const id = Number(key), contact = ledger.infected[id], target = this.world.entities.get(id);
      if (!target || target.kind !== 'infected' || (target.health.current <= 0 && (target.infected?.recoverAt ?? -1) < 0)) { delete ledger.infected[id]; continue; }
      const gap = car.physics.hullDistance(target.transform.x, target.transform.z) - (target.combat?.radius ?? .4);
      if (gap >= tuning.separation) {
        contact.separatedAt ??= tick;
        if (tick - contact.separatedAt >= tuning.separationTicks) contact.contactId = null;
      } else contact.separatedAt = null;
      if (!attackable || !this.hullAttackers.includes(target) || gap + (target.combat?.radius ?? .4) > tuning.reach) {
        contact.windupAt = contact.attackId = null;
        if (contact.contactId === null && tick >= contact.cooldownUntil) delete ledger.infected[id];
      }
    }
    if (!attackable) return;
    for (const target of this.hullAttackers) {
      if (!this.operable(car)) break;
      if (car.physics.hullDistance(target.transform.x, target.transform.z) > tuning.reach) continue;
      const contact = ledger.infected[target.id] ??= { contactId: null, separatedAt: null, windupAt: null, attackId: null, cooldownUntil: 0 };
      if (contact.windupAt === null && tick >= contact.cooldownUntil) {
        contact.windupAt = tick; contact.attackId = ++ledger.sequence;
        this.world.events.emit({ type: 'vehicle.attack-windup', tick, sourceId: car.entity.id, targetId: target.id, attackId: contact.attackId, hitAt: tick + tuning.windupTicks });
      }
      if (contact.windupAt !== null && tick - contact.windupAt >= tuning.windupTicks) {
        this.apcHit(car, target, 'attack', null, contact.attackId);
        contact.windupAt = contact.attackId = null; contact.cooldownUntil = tick + tuning.cooldownTicks;
      }
    }
  }
  /** L9: obstacle and wreck contact onsets cost 10 durability each, with the infected separation rule; aliases of one wreck bill once. */
  private floorContacts(car: Car): void {
    const p = car.entity.transform, def = car.physics.def, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const ledger = car.entity.vehicle!.apcContacts ??= { sequence: 0, infected: {} };
    const book = ledger.obstacles ??= {};
    const seen = new Set<number>();
    const note = (id: number, gap: number): void => {
      seen.add(id);
      let entry = book[id];
      if (gap <= apcFloor.obstacleContactGap) {
        entry ??= book[id] = { contactId: null, separatedAt: null };
        entry.separatedAt = null;
        if (entry.contactId === null) { entry.contactId = ++ledger.sequence; this.apcHit(car, { id }, 'obstacle', entry.contactId, null); }
      } else if (entry && gap >= apcDurability.separation) {
        entry.separatedAt ??= this.world.tick;
        if (this.world.tick - entry.separatedAt >= apcDurability.separationTicks) delete book[id];
      } else if (entry) entry.separatedAt = null;
    };
    // Axis-aligned prop/wreck box against the oriented hull, as in impacts(); the gap is the larger per-axis clearance.
    const boxGap = (x: number, z: number, halfX: number, halfZ: number): number => {
      const dx = x - p.x, dz = z - p.z, lx = dx * c - dz * s, lz = dx * s + dz * c;
      const hx = Math.abs(c) * halfX + Math.abs(s) * halfZ, hz = Math.abs(s) * halfX + Math.abs(c) * halfZ;
      return Math.max(Math.abs(lx) - (def.length / 2 + hx), Math.abs(lz) - (def.width / 2 + hz));
    };
    for (const item of this.obstacles.items) {
      if (item.broken && !book[item.entity.id]) continue;
      note(item.entity.id, item.broken ? Infinity : boxGap(item.entity.transform.x, item.entity.transform.z, item.halfX, item.halfZ));
    }
    for (const wall of this.world.interactables?.walls ?? []) {
      const entity = wall.entityId === undefined ? undefined : this.world.entities.get(wall.entityId);
      if (entity?.destructible && entity.health.current > 0 && ['fence', 'cone', 'barricade', 'trash-can', 'mailbox'].includes(entity.destructible.kind)) note(entity.id, boxGap(entity.transform.x, entity.transform.z, wall.halfX, wall.halfZ));
    }
    for (const [id, boxes] of this.wrecks) {
      let gap = Infinity; for (const b of boxes) gap = Math.min(gap, boxGap(b.x, b.z, b.halfX, b.halfZ));
      note(id, gap);
    }
    // Parked or abandoned cars are wrecks too: sample the hull outline against their chassis.
    for (const other of this.cars.values()) {
      if (other === car) continue;
      let gap = Infinity;
      for (const [lx, lz] of [[0, 0], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const wx = p.x + c * lx * def.length / 2 + s * lz * def.width / 2, wz = p.z - s * lx * def.length / 2 + c * lz * def.width / 2;
        gap = Math.min(gap, other.physics.hullDistance(wx, wz));
      }
      note(other.entity.id, gap);
    }
    for (const key of Object.keys(book)) if (!seen.has(Number(key))) delete book[Number(key)];
  }
  private apcHit(car: Car, target: Pick<EntitySnapshot, 'id'>, source: 'contact' | 'attack' | 'obstacle', contactId: number | null, attackId: number | null): void {
    const before = car.entity.health.current;
    this.damage(car.entity.id, source === 'attack' ? apcDurability.attackDamage : apcDurability.contactDamage);
    this.world.events.emit({ type: 'vehicle.durability-hit', tick: this.world.tick, sourceId: car.entity.id, targetId: target.id, source, contactId, attackId, before, after: car.entity.health.current });
  }
  postPhysics(): void {
    this.bicycle.postPhysics();
    for (const car of this.cars.values()) {
      if (car.entity.vehicle!.scripted) continue;
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
      // The L9 mission APC keeps its staged engine/tyres until the authored impact stops it.
      // Reuse the convoy emitter's bounded cadence and persistent audio loops.
      if (this.world.missions?.l9?.state.carId === car.entity.id && state.driver === 1 && this.operable(car) && this.world.tick % 6 === 0)
        emitEngine(this.world, car.entity.id, car.physics.speed, true);
      if (this.active === car.entity.id && this.operable(car) && car.physics.recoverFlip()) {
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
    if (!car?.physics.def.transport || (!actor?.civilian && !actor?.companion && !actor?.escort) || actor.health.current <= 0 || actor.civilian?.pet || actor.infected || actorId === 1 || !this.operable(car) || car.physics.speed >= 1 || actor.passengerOf !== undefined) return false;
    this.localPoint(car, car.physics.def.doorX, car.physics.def.width / 2 + .55);
    if (Math.hypot(actor.transform.x - this.position.x, actor.transform.z - this.position.z) > .7) return false;
    const c = actor.civilian;
    const passenger: VehiclePassenger = { id: actorId, seat: (car.entity.vehicle!.passengers?.length ?? 0) % car.physics.def.transport.seats.length, phase: 'enter', started: this.world.tick, from: { ...actor.transform }, pauseUntil: c?.pauseUntil ?? 0, floorY: c?.floorY, story: c?.story ? { ...c.story } : c?.story };
    (car.entity.vehicle!.passengers ??= []).push(passenger);
    actor.passengerOf = carId; if (c) { c.pauseUntil = Number.MAX_SAFE_INTEGER; c.path.length = 0; }
    return true;
  }
  /** Escape lanes provide their complete group, including losses; no kill-count condition. */
  groupBoarded(carId: number, roster: readonly number[]): boolean {
    const car = this.cars.get(carId);
    if (!car?.physics.def.transport || !this.operable(car) || this.world.entities.get(1)!.health.current <= 0 || car.entity.vehicle!.driver !== 1) return false;
    if (this.transition?.carId === carId && this.transition.kind === 'enter' && this.world.tick - this.transition.tick < vehicleBoardingTicks) return false;
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
      if (nav && !nav.contains(this.position.x, this.position.z, actor.combat?.radius ?? survivor.radius)) continue;
      if (!this.world.solids.clear(this.position, actor.combat?.radius ?? survivor.radius, actorId)) continue;
      if ([...this.world.entities.iterate()].some(e => e.id !== actorId && !e.hidden && e.health.current > 0 && (e.civilian || e.survivor) && Math.hypot(e.transform.x - this.position.x, e.transform.z - this.position.z) < .8)) continue;
      if (this.world.physics.world!.intersectionWithShape(this.position, this.identity, this.exitShape, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, undefined, this.world.physics.playerCollider!)) continue;
      passenger.side = side; passenger.phase = 'exit'; passenger.started = this.world.tick;
      passenger.from = { ...actor.transform }; passenger.to = { ...this.position, y: actor.companion ? .3 : this.position.y, yaw: car.entity.transform.yaw };
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
      const seat = car.physics.def.transport!.seats[p.seat ?? i % car.physics.def.transport!.seats.length];
      this.localPoint(car, seat.x, seat.z);
      const seated = { ...this.position, y: car.entity.transform.y - (car.physics.def.suspension + car.physics.def.wheelRadius + .15) + seat.y, yaw: car.entity.transform.yaw };
      if (p.phase === 'seated') {
        Object.assign(actor.transform, seated); actor.hidden = true; this.world.spatial.delete(actor.id); continue;
      }
      const entering = p.phase === 'enter';
      this.localPoint(car, car.physics.def.doorX, (p.side ?? 1) * (car.physics.def.width / 2 + .05));
      const door = { ...this.position, y: car.physics.def.stepHeight + (actor.companion ? .3 : .7), yaw: car.entity.transform.yaw };
      // The hidden walk between doorway and seat is still continuous in the authoritative snapshot.
      const toSeat = entering && elapsed > 42, toDoor = !entering && elapsed < 12;
      const start = toSeat ? door : entering || toDoor ? p.from : door;
      const target = toSeat ? seated : entering || toDoor ? door : p.to!;
      const t = Math.max(0, Math.min(1, toSeat ? (elapsed - 42) / 18 : toDoor ? elapsed / 12 : (elapsed - 12) / 30)), weight = t * t * (3 - 2 * t);
      actor.transform.x = start.x + (target.x - start.x) * weight;
      actor.transform.z = start.z + (target.z - start.z) * weight;
      actor.transform.y = start.y + (target.y - start.y) * weight;
      actor.transform.yaw = car.entity.transform.yaw + (entering ? Math.PI / 2 : -Math.PI / 2);
      actor.hidden = entering ? elapsed >= 42 : elapsed < 12;
      if (c) { c.floorY = actor.transform.y - .7; c.story = { clip: entering ? 'npc-sit-down' : 'npc-stand-up', start: p.started }; }
      if (actor.hidden) this.world.spatial.delete(actor.id); else this.world.spatial.set(actor.id, actor.transform.x, actor.transform.z);
      if (elapsed < vehicleBoardingTicks) continue;
      if (entering) {
        p.phase = 'seated'; actor.hidden = true;
        this.world.events.emit({ type: 'vehicle.entered', tick: this.world.tick, sourceId: car.entity.id, targetId: actor.id, role: 'passenger' });
      } else {
        if (!this.world.solids.clear(p.to!, actor.combat?.radius ?? survivor.radius, actor.id)) { p.phase = 'seated'; actor.hidden = true; continue; }
        Object.assign(actor.transform, p.to); actor.hidden = false; delete actor.passengerOf; if (c) { c.pauseUntil = p.pauseUntil; c.floorY = p.floorY; c.story = p.story ?? null; }
        passengers.splice(i, 1);
        this.world.events.emit({ type: 'vehicle.exited', tick: this.world.tick, sourceId: car.entity.id, targetId: actor.id, role: 'passenger' });
      }
    }
  }
  /** Call only after the complete living group is seated; copy before replacing the level. */
  transfer(carId: number): VehicleTransfer {
    const car = this.cars.get(carId);
    if (!car?.physics.def.transport || !this.operable(car) || this.world.entities.get(1)!.health.current <= 0 || car.entity.vehicle!.driver !== 1 || car.entity.vehicle!.passengers?.some(p => p.phase !== 'seated')) throw new Error('Transport is not ready to depart');
    if (this.transition?.carId === carId && this.transition.kind === 'enter' && this.world.tick - this.transition.tick < vehicleBoardingTicks) throw new Error('Driver is still boarding');
    const ids = [1, ...(car.entity.vehicle!.passengers ?? []).map(p => p.id)];
    const payload = structuredClone({ tick: this.world.tick, infiniteCharges: this.world.combat?.runner.infiniteCharges ?? false, vehicle: car.entity, occupants: ids.map(id => this.world.entities.get(id)!).filter(e => e.health.current > 0 && !e.infected && e.civilian?.state !== 'finished') });
    payload.vehicle.vehicle!.passengers = (payload.vehicle.vehicle!.passengers ?? []).filter(p => payload.occupants.some(e => e.id === p.id));
    payload.vehicle.vehicle!.attached = [];
    return payload;
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
      if (actor.companion) for (const key of ['until', 'barkAt', 'hurtAt'] as const) if (actor.companion[key]) actor.companion[key] += delta;
      if (actor.escort) { actor.escort.downedAt += delta; for (const key of ['attackAt', 'knockedUntil'] as const) if (actor.escort[key]) actor.escort[key]! += delta; }
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
    // A campaign handover leaves the old district's infected behind, retaining the ID sequence.
    if (vehicle.vehicle.apcContacts) { vehicle.vehicle.apcContacts.infected = {}; delete vehicle.vehicle.apcContacts.obstacles; }
    vehicle.transform.x = position.x; vehicle.transform.z = position.z; vehicle.transform.yaw = yaw;
    for (const actor of payload.occupants) {
      if (actor.id === 1) Object.assign(this.world.entities.get(1)!, actor);
      else this.world.entities.replace(actor);
    }
    this.world.entities.replace(vehicle); this.rebuild();
    for (const actor of payload.occupants) {
      const live = this.world.entities.get(actor.id)!; Object.assign(live.transform, vehicle.transform); live.hidden = true; this.world.spatial.delete(live.id);
    }
    this.updatePassengers(this.cars.get(vehicle.id)!);
    const player = this.world.entities.get(1)!;
    if (player.weapons && this.world.combat) {
      const saved = player.weapons;
      this.world.combat.rackCapacity = Math.max(this.world.combat.rackCapacity, saved.LEFT.rack.length, saved.RIGHT.rack.length);
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
      for (const contact of Object.values(state.apcContacts?.infected ?? {})) {
        if (contact.separatedAt !== null) contact.separatedAt += delta;
        if (contact.windupAt !== null) contact.windupAt += delta;
        if (contact.cooldownUntil) contact.cooldownUntil += delta;
      }
      for (const contact of Object.values(state.apcContacts?.obstacles ?? {})) if (contact.separatedAt !== null) contact.separatedAt += delta;
      for (const passenger of state.passengers ?? []) { passenger.started += delta; passenger.pauseUntil += delta; if (passenger.story) passenger.story.start += delta; }
      const physics = new VehicleBody(vehicleDef(entity.archetype), this.world.physics.world!, entity.transform, entity.transform.yaw);
      physics.overspeedDamp = apcFloor.overspeedDamp;
      Object.assign(physics.transform, entity.transform); Object.assign(physics.previous, entity.transform); entity.transform = physics.transform;
      physics.body.setTranslation(entity.transform, true);
      physics.speed = state.speed; physics.forwardSpeed = state.forwardSpeed;
      physics.body.setLinvel({ x: Math.cos(entity.transform.yaw) * state.forwardSpeed, y: 0, z: -Math.sin(entity.transform.yaw) * state.forwardSpeed }, true);
      this.cars.set(entity.id, { entity, physics, doorTicks: 0, noEnterUntil: this.world.tick, hits: new Map(), crashAt: this.world.tick });
      physics.speedCap = this.speedShare(this.cars.get(entity.id)!);
      if (state.driver === 1) this.active = entity.id;
    }
    this.world.entities.get(1)!.hidden = this.active !== null;
    this.world.physics.playerCollider!.setEnabled(this.active === null);
  }
  dispose(): void { this.obstacles.dispose(); for (const car of this.cars.values()) car.physics.dispose(); this.cars.clear(); this.active = null; this.transition = null; }
}
