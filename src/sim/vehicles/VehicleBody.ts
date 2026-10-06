// Port of Bruno Simon folio-2025 PhysicsVehicle.js (MIT, 41046b5).
// Four raycast wheels, low COM, engine taper, reverse braking and bounded stuck history.
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FIXED_DT } from '../../core/Clock';
import type { VehicleDef } from '../../data/vehicles';
import type { Transform } from '../world/types';
export interface DriveIntent { throttle: number; steer: number; brake: boolean; boost: boolean }
/** Native resources belong to the owning Rapier world. All timing uses fixed simulation ticks. */
export class VehicleBody {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly controller: RAPIER.DynamicRayCastVehicleController;
  readonly transform: Transform;
  readonly previous: Transform;
  readonly rotation = { x: 0, y: 0, z: 0, w: 1 };
  readonly wheels = Array.from({ length: 4 }, () => ({ rotation: 0, steer: 0, suspension: 0, contact: false }));
  readonly intent: DriveIntent = { throttle: 0, steer: 0, brake: true, boost: false };
  boostScale = 1;
  speed = 0; forwardSpeed = 0; roll = 0; stuck = false;
  private readonly travel = new Float64Array(180);
  private travelIndex = 0; private travelCount = 0; private travelSum = 0;
  constructor(readonly def: VehicleDef, readonly world: RAPIER.World, position: { x: number; z: number }, yaw = 0) {
    const height = def.suspension + def.wheelRadius + .15;
    this.transform = { ...position, y: height, yaw }; this.previous = { ...this.transform };
    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, height, position.z).setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }).setLinearDamping(.01).setAngularDamping(1.5).setCanSleep(false).setCcdEnabled(true));
    const inertia = { x: def.mass * .5, y: def.mass * def.length ** 2 / 12, z: def.mass * def.length ** 2 / 12 };
    this.collider = world.createCollider(RAPIER.ColliderDesc.cuboid(def.length / 2, .3, def.width / 2).setFriction(.3).setMassProperties(def.mass, { x: 0, y: -.3, z: 0 }, inertia, { x: 0, y: 0, z: 0, w: 1 }), this.body);
    this.controller = world.createVehicleController(this.body);
    this.controller.indexUpAxis = 1; this.controller.setIndexForwardAxis = 0;
    for (let i = 0; i < 4; i++) {
      this.controller.addWheel({ x: i < 2 ? def.wheelbase / 2 : -def.wheelbase / 2, y: -.15, z: i % 2 === 0 ? def.width * .4 : -def.width * .4 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 1 }, def.suspension, def.wheelRadius);
      this.controller.setWheelSuspensionStiffness(i, def.stiffness);
      this.controller.setWheelSuspensionCompression(i, 4.4); this.controller.setWheelSuspensionRelaxation(i, 2.3);
      this.controller.setWheelMaxSuspensionForce(i, def.mass * 20); this.controller.setWheelMaxSuspensionTravel(i, .25);
      this.controller.setWheelFrictionSlip(i, 3); this.controller.setWheelSideFrictionStiffness(i, 1);
    }
  }
  prePhysics(): void {
    Object.assign(this.previous, this.transform);
    const { throttle, brake, steer, boost } = this.intent;
    const reversing = throttle * this.forwardSpeed < -.5;
    const limit = this.def.topSpeed * (boost ? 1.25 * this.boostScale : 1);
    const force = brake || reversing ? 0 : throttle * this.def.engineForce * (boost ? 1.5 * this.boostScale : 1) * Math.max(0, 1 - Math.abs(this.forwardSpeed) / limit);
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelSteering(i, i < 2 ? steer * this.def.steering : 0);
      this.controller.setWheelEngineForce(i, force);
      this.controller.setWheelBrake(i, (brake || reversing ? this.def.mass * .16 : Math.abs(throttle) < .05 ? this.def.mass * .004 : 0));
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
    for (let i = 0; i < 4; i++) { const w = this.wheels[i]; w.rotation += this.forwardSpeed * FIXED_DT / this.def.wheelRadius; w.steer = this.controller.wheelSteering(i) ?? 0; w.suspension = this.controller.wheelSuspensionLength(i) ?? this.def.suspension; w.contact = this.controller.wheelIsInContact(i); }
    if (Math.abs(this.intent.throttle) > .5) {
      const distance = Math.hypot(p.x - this.previous.x, p.z - this.previous.z);
      this.travelSum += distance - this.travel[this.travelIndex]; this.travel[this.travelIndex] = distance;
      this.travelIndex = (this.travelIndex + 1) % 180; this.travelCount = Math.min(180, this.travelCount + 1);
      this.stuck = this.travelCount === 180 && this.travelSum < .5;
    } else this.clearStuck();
  }
  clearStuck(): void { this.travel.fill(0); this.travelCount = this.travelIndex = this.travelSum = 0; this.stuck = false; }
  dispose(): void { this.world.removeVehicleController(this.controller); this.world.removeRigidBody(this.body); }
}
