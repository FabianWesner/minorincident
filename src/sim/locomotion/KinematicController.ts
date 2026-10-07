import { faceMotion, motionResponse, resetResponse, respond, playerMotionLimits } from './MotionResponse';
import { FIXED_DT } from '../../core/Clock';
import { survivor } from '../../data/survivor';
import type { InputFrame } from '../../input/InputFrame';
import type { Physics } from '../../physics/Physics';
import type { NavGrid } from '../ai/NavGrid';
import type { Transform } from '../world/types';

/** Soft crowd circles have no Rapier body. E07 supplies live transform references. */
export interface CrowdObstacle { transform: { x: number; z: number }; radius: number }
/** Rapier sweep/slide with bounded acceleration. Intent runs before physics, pose after it (Bruno Player.js). */
export class KinematicController {
  readonly response = motionResponse();
  private navigating = false;
  readonly velocity = { x: 0, z: 0 };
  readonly displacement = { x: 0, y: 0, z: 0 };
  private readonly next = { x: 0, y: 0, z: 0 };
  navigationGrid: NavGrid | null = null;
  speedScale = 1;
  crowd: readonly CrowdObstacle[] = [];
  /** Solid props without a static collider (the parked bicycle): always pushed out of, at up to 4 m/s. */
  props: readonly CrowdObstacle[] = [];
  groundHeight: ((x: number, z: number) => number) | null = null;
  constructor(private readonly physics: Physics) {}
  move(input: InputFrame, transform: Transform, enabled: boolean): void {
    transform.y = this.physics.playerBody!.translation().y;
    const length = Math.hypot(input.move.x, input.move.z);
    const magnitude = Math.min(1, length);
    const x = enabled && length > 0 ? input.move.x / length : 0;
    const z = enabled && length > 0 ? input.move.z / length : 0;
    const navigation = enabled && (!!input.navigation || this.navigating && length === 0);
    if (navigation) {
      if (!this.navigating) { this.response.vx = this.velocity.x; this.response.vz = this.velocity.z; this.response.ax = this.response.az = this.response.omega = 0; }
      respond(this.response, x * magnitude * survivor.speed * this.speedScale, z * magnitude * survivor.speed * this.speedScale, playerMotionLimits);
      this.velocity.x = this.response.vx; this.velocity.z = this.response.vz;
    } else {
      const dx = x * magnitude * survivor.speed * this.speedScale - this.velocity.x;
      const dz = z * magnitude * survivor.speed * this.speedScale - this.velocity.z;
      const delta = Math.hypot(dx, dz);
      const amount = Math.min(delta, (length > 0 && enabled ? survivor.acceleration : survivor.deceleration) * FIXED_DT);
      if (delta > 0) { this.velocity.x += dx / delta * amount; this.velocity.z += dz / delta * amount; }
    }
    this.navigating = navigation && (length > 0 || Math.hypot(this.velocity.x, this.velocity.z, this.response.ax, this.response.az) > .002);
    if (!enabled) this.velocity.x = this.velocity.z = 0;
    this.displacement.x = this.velocity.x * FIXED_DT; this.displacement.z = this.velocity.z * FIXED_DT;
    // Continuous downward intent grounds the capsule; static geometry remains authoritative.
    this.displacement.y = -0.02;
    if (enabled) {
      // Thin paving edges can defeat Rapier autostep at low joystick speeds.
      // Start a bounded upward sweep at the capsule's leading foot, using the
      // same GLB support tops as NPC grounding. The sweep still tests all solids.
      const supportX = transform.x + this.displacement.x + x * (survivor.radius + .02), supportZ = transform.z + this.displacement.z + z * (survivor.radius + .02);
      const support = (px: number, pz: number) => this.groundHeight?.(px, pz) ?? this.physics.floorHeight(px, pz);
      // Probe the whole leading footprint: a thin raised curb can lie between
      // the centre and the leading toe, above the paving sampled at the toe.
      const ground = Math.max(support(supportX, supportZ), support(transform.x + this.displacement.x, transform.z + this.displacement.z), support((supportX + transform.x) / 2, (supportZ + transform.z) / 2));
      const clearance = ground > .01 || navigation ? .02 : magnitude > 0 ? .01 : .005;
      this.displacement.y = Math.max(this.displacement.y, Math.min(.06, ground + survivor.height / 2 + clearance - transform.y));
    }
    if (enabled) {
      let px = 0, pz = 0;
      for (const prop of this.props) {
        const dx = transform.x - prop.transform.x, dz = transform.z - prop.transform.z, distance = Math.hypot(dx, dz), overlap = survivor.radius + prop.radius - distance;
        if (overlap > 0) { px += (distance > 1e-6 ? dx / distance : 1) * overlap; pz += (distance > 1e-6 ? dz / distance : 0) * overlap; }
      }
      const length = Math.hypot(px, pz);
      if (length > 0) { const scale = Math.min(1, 4 * FIXED_DT / length); this.displacement.x += px * scale; this.displacement.z += pz * scale; }
    }
    let pushX = 0, pushZ = 0, overlaps = 0;
    if (enabled && !input.attackInPlace) for (const neighbor of this.crowd) {
      const dx = transform.x - neighbor.transform.x, dz = transform.z - neighbor.transform.z;
      const distance = Math.hypot(dx, dz), overlap = survivor.radius + neighbor.radius - distance;
      if (overlap > 0) { pushX += (distance > 0 ? dx / distance : x) * overlap; pushZ += (distance > 0 ? dz / distance : z) * overlap; overlaps++; }
    }
    if (overlaps) {
      const pushLength = Math.hypot(pushX, pushZ), scale = pushLength > 0 ? Math.min(1, 2 * FIXED_DT / pushLength) : 0;
      this.displacement.x += pushX * scale; this.displacement.z += pushZ * scale;
      // Crowd resistance can consume at most 75% of forward intent. Static walls are swept AFTER this.
      if (magnitude > 0) {
        const forward = this.displacement.x * x + this.displacement.z * z;
        const minimum = Math.max(survivor.minimumEscapeSpeed, Math.hypot(this.velocity.x, this.velocity.z) * 0.25) * FIXED_DT;
        if (forward < minimum) { this.displacement.x += x * (minimum - forward); this.displacement.z += z * (minimum - forward); }
      }
    }
    if (navigation && this.navigationGrid && transform.y < this.physics.floorHeight(transform.x, transform.z) + survivor.height / 2 + .06) {
      // Keep coast at ground-level route corners inside the grid clearance.
      // Elevated supports need the 3D capsule sweep: the grid has no height.
      this.next.x = transform.x; this.next.z = transform.z;
      this.navigationGrid.move(this.next, this.displacement.x, this.displacement.z, survivor.radius);
      this.displacement.x = this.next.x - transform.x; this.displacement.z = this.next.z - transform.z;
    }
    const controller = this.physics.characterController!, collider = this.physics.playerCollider!;
    controller.computeColliderMovement(collider, this.displacement, undefined, collider.collisionGroups());
    controller.computedMovement(this.displacement);
    // Rapier's skin-contact correction can alternate by tens of micrometres on a
    // resting capsule. Keep that numerical noise from accumulating into visible
    // idle vibration; real falls, steps and horizontal pushes still move it.
    if (magnitude === 0 && Math.hypot(this.velocity.x, this.velocity.z) < .001 && Math.hypot(this.displacement.x, this.displacement.z) < 1e-6 && Math.abs(this.displacement.y) < .0001) this.displacement.y = 0;
    this.next.x = transform.x + this.displacement.x; this.next.y = transform.y + this.displacement.y; this.next.z = transform.z + this.displacement.z;
    this.physics.playerBody!.setNextKinematicTranslation(this.next);
    if (navigation && Math.hypot(this.displacement.x - this.velocity.x * FIXED_DT, this.displacement.z - this.velocity.z * FIXED_DT) > .001) {
      this.response.vx = this.velocity.x = this.displacement.x / FIXED_DT;
      this.response.vz = this.velocity.z = this.displacement.z / FIXED_DT;
    }
    if (!enabled) return;
    const aim = input.aim;
    const aiming = aim && (input.left.held || input.right.held || input.left.down || input.right.down);
    if (aiming && Math.hypot(aim.x, aim.z) > 0) transform.yaw = -Math.atan2(aim.z, aim.x);
    else if (navigation) transform.yaw = faceMotion(this.response, transform.yaw, this.velocity.x, this.velocity.z);
    else if (magnitude > 0) {
      const target = -Math.atan2(z, x), delta = Math.atan2(Math.sin(target - transform.yaw), Math.cos(target - transform.yaw));
      transform.yaw += Math.sign(delta) * Math.min(Math.abs(delta), survivor.turnSpeed * FIXED_DT);
    }
  }
  reset(): void { this.velocity.x = this.velocity.z = 0; resetResponse(this.response); this.navigating = false; }
}
