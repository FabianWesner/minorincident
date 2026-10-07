// Port of Bruno Simon folio-2025 PhysicsVehicle.js (MIT, 41046b5).
// Four raycast wheels, low COM, engine taper, reverse braking and bounded stuck history.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FIXED_DT } from '../../core/Clock';
import type { VehicleDef } from '../../data/vehicles';
import type { Transform } from '../world/types';
export interface DriveIntent { throttle: number; steer: number; brake: boolean; boost: boolean; handbrake?: boolean }
/** Native resources belong to the owning Rapier world. All timing uses fixed simulation ticks. */
export class VehicleBody {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly transform: Transform;
  readonly previous: Transform;
  readonly rotation = { x: 0, y: 0, z: 0, w: 1 };
  readonly previousRotation = { x: 0, y: 0, z: 0, w: 1 };
  readonly wheels = Array.from({ length: 4 }, () => ({ rotation: 0, steer: 0, suspension: 0, contact: false }));
  readonly previousWheels = Array.from({ length: 4 }, () => ({ rotation: 0, steer: 0, suspension: 0, contact: false }));
  readonly intent: DriveIntent = { throttle: 0, steer: 0, brake: true, boost: false };
  boostScale = 1;
  speed = 0; forwardSpeed = 0; roll = 0; stuck = false;
  steeringAngle = 0; braking = true; upsideDown = false;
  private upsideDownTicks = 0;
  private readonly travel = new Float64Array(180);
  private travelIndex = 0; private travelCount = 0; private travelSum = 0;
  constructor(readonly def: VehicleDef, readonly world: RAPIER.World, position: { x: number; z: number }, yaw = 0) {
    const height = def.suspension + def.wheelRadius + .15;
    this.transform = { ...position, y: height, yaw }; this.previous = { ...this.transform };
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, height, position.z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setLinearDamping(.01).setAngularDamping(1.5).setCanSleep(false).setCcdEnabled(true));
    const inertia = { x: def.mass * .5, y: def.mass * def.length ** 2 / 12, z: def.mass * def.length ** 2 / 12 };
    this.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(def.length / 2, .3, def.width / 2).setFriction(.3).setMassProperties(def.mass, { x: 0, y: def.handling.centerOfMass, z: 0 }, inertia, { x: 0, y: 0, z: 0, w: 1 }), this.body);
    Object.assign(this.rotation, this.body.rotation()); Object.assign(this.previousRotation, this.rotation);
    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1; this.controller.setIndexForwardAxis = 0;
    for (let i = 0; i < 4; i++) {
      this.controller.addWheel({ x: i < 2 ? def.wheelbase / 2 : -def.wheelbase / 2, y: -.15, z: i % 2 === 0 ? def.width * .4 : -def.width * .4 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, def.suspension, def.wheelRadius);
      this.controller.setWheelSuspensionStiffness(i, def.stiffness);
      this.controller.setWheelSuspensionCompression(i, def.handling.compression); this.controller.setWheelSuspensionRelaxation(i, def.handling.relaxation);
      this.controller.setWheelMaxSuspensionForce(i, def.mass * 20); this.controller.setWheelMaxSuspensionTravel(i, def.handling.suspensionTravel);
      this.controller.setWheelFrictionSlip(i, def.handling.grip); this.controller.setWheelSideFrictionStiffness(i, 1);
      this.wheels[i].suspension = this.previousWheels[i].suspension = def.suspension;
    }
  }
  prePhysics(): void {
    Object.assign(this.previous, this.transform);
    Object.assign(this.previousRotation, this.rotation);
    for (let i = 0; i < 4; i++) Object.assign(this.previousWheels[i], this.wheels[i]);
    const { throttle, brake, steer, boost, handbrake } = this.intent, h = this.def.handling;
    const reversing = throttle * this.forwardSpeed < -.5;
    const limit = throttle < 0 ? h.reverseSpeed : this.def.topSpeed * (boost ? 1.25 * this.boostScale : 1);
    const taper = Math.max(0, Math.min(1, (1 - Math.abs(this.forwardSpeed) / limit) / (1 - h.engineTaperStart)));
    const force = brake || reversing ? 0 : throttle * this.def.engineForce * (boost ? 1.5 * this.boostScale : 1) * taper;
    const lock = this.def.steering + (h.highSpeedSteering - this.def.steering) * Math.min(1, this.speed / this.def.topSpeed);
    this.steeringAngle += (Math.max(-1, Math.min(1, steer)) * lock - this.steeringAngle) * (1 - Math.exp(-h.steeringResponse * FIXED_DT));
    this.braking = brake || reversing || !!handbrake;
    for (let i = 0; i < 4; i++) {
      const rearDrift = !!handbrake && i >= 2;
      this.controller.setWheelSteering(i, i < 2 ? this.steeringAngle : 0);
      this.controller.setWheelEngineForce(i, rearDrift ? 0 : force);
      this.controller.setWheelBrake(i, this.def.mass * (brake || reversing ? h.brake : rearDrift ? h.handbrake : Math.abs(throttle) < .05 ? h.idleBrake : 0));
      this.controller.setWheelFrictionSlip(i, rearDrift ? h.driftGrip : h.grip);
      this.controller.setWheelSideFrictionStiffness(i, rearDrift ? h.driftGrip / h.grip : 1);
    }
    this.controller.updateVehicle(FIXED_DT, RAPIER.QueryFilterFlags.EXCLUDE_SENSORS);
  }
  postPhysics(): void {
    const p = this.body.translation(), q = this.body.rotation(), v = this.body.linvel();
    Object.assign(this.rotation, q);
    this.transform.x = p.x; this.transform.y = p.y; this.transform.z = p.z;
    this.transform.yaw = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
    this.roll = Math.atan2(2 * (q.w * q.x + q.y * q.z), 1 - 2 * (q.x * q.x + q.z * q.z));
    this.speed = Math.hypot(v.x, v.z); this.forwardSpeed = v.x * Math.cos(this.transform.yaw) - v.z * Math.sin(this.transform.yaw);
    this.upsideDown = 1 - 2 * (q.x * q.x + q.z * q.z) < .4;
    this.upsideDownTicks = this.upsideDown && this.speed < 3 ? this.upsideDownTicks + 1 : 0;
    for (let i = 0; i < 4; i++) {
      const w = this.wheels[i]; w.rotation += this.forwardSpeed * FIXED_DT / this.def.wheelRadius; w.steer = this.steeringAngle * (i < 2 ? 1 : 0);
      w.suspension += ((this.controller.wheelSuspensionLength(i) ?? this.def.suspension) - w.suspension) * (1 - Math.exp(-this.def.handling.suspensionResponse * FIXED_DT));
      w.contact = this.controller.wheelIsInContact(i);
    }
    if (Math.abs(this.intent.throttle) > .5 && !this.braking && !this.upsideDown) {
      const distance = Math.hypot(p.x - this.previous.x, p.z - this.previous.z);
      this.travelSum += distance - this.travel[this.travelIndex]; this.travel[this.travelIndex] = distance;
      this.travelIndex = (this.travelIndex + 1) % 180; this.travelCount = Math.min(180, this.travelCount + 1);
      this.stuck = this.travelCount === 180 && this.travelSum < .5;
    } else this.clearStuck();
  }
  clearStuck(): void { this.travel.fill(0); this.travelCount = this.travelIndex = this.travelSum = 0; this.stuck = false; }
  /** Bruno's mass-scaled jump/roll recovery, retried in sim time while a driver is overturned. */
  recoverFlip(): boolean {
    if (this.upsideDownTicks < Math.ceil(this.def.handling.flipDelay / FIXED_DT)) return false;
    const q = this.body.rotation(), up = { x: 2 * (q.x * q.y - q.w * q.z), z: 2 * (q.y * q.z + q.w * q.x) };
    const length = Math.hypot(up.x, up.z), force = this.def.mass * this.def.handling.flipTorque;
    // up × worldUp rotates the chassis toward upright; choose its forward axis at exact inversion.
    const axis = length > .1 ? { x: -up.z / length, z: up.x / length } : { x: Math.cos(this.transform.yaw), z: -Math.sin(this.transform.yaw) };
    this.body.applyImpulse({ x: 0, y: this.def.mass * this.def.handling.flipLift, z: 0 }, true);
    this.body.applyTorqueImpulse({ x: axis.x * force, y: 0, z: axis.z * force }, true);
    this.upsideDownTicks = 0; this.clearStuck(); return true;
  }
  dispose(): void { this.world.removeVehicleController(this.controller); this.world.removeRigidBody(this.body); }
}
