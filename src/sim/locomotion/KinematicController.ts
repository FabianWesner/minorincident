import { FIXED_DT } from '../../core/Clock';
import { survivor } from '../../data/survivor';
import type { InputFrame } from '../../input/InputFrame';
import type { Physics } from '../../physics/Physics';
import type { Transform } from '../world/types';

/** Soft crowd circles have no Rapier body. E07 supplies live transform references. */
export interface CrowdObstacle { transform: { x: number; z: number }; radius: number }
/** Rapier sweep/slide with bounded acceleration. Intent runs before physics, pose after it (Bruno Player.js). */
export class KinematicController {
  readonly velocity = { x: 0, z: 0 };
  readonly displacement = { x: 0, y: 0, z: 0 };
  private readonly next = { x: 0, y: 0, z: 0 };
  speedScale = 1;
  crowd: readonly CrowdObstacle[] = [];
  constructor(private readonly physics: Physics) {}
  move(input: InputFrame, transform: Transform, enabled: boolean): void {
    const length = Math.hypot(input.move.x, input.move.z);
    const magnitude = Math.min(1, length);
    const x = enabled && length > 0 ? input.move.x / length : 0;
    const z = enabled && length > 0 ? input.move.z / length : 0;
    const dx = x * magnitude * survivor.speed * this.speedScale - this.velocity.x;
    const dz = z * magnitude * survivor.speed * this.speedScale - this.velocity.z;
    const delta = Math.hypot(dx, dz);
    const amount = Math.min(delta, (length > 0 && enabled ? survivor.acceleration : survivor.deceleration) * FIXED_DT);
    if (delta > 0) { this.velocity.x += dx / delta * amount; this.velocity.z += dz / delta * amount; }
    if (!enabled) this.velocity.x = this.velocity.z = 0;
    this.displacement.x = this.velocity.x * FIXED_DT; this.displacement.z = this.velocity.z * FIXED_DT;
    // Continuous downward intent grounds the capsule; static geometry remains authoritative.
    this.displacement.y = -0.02;
    let pushX = 0, pushZ = 0, overlaps = 0;
    if (enabled) for (const neighbor of this.crowd) {
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
    const controller = this.physics.characterController!, collider = this.physics.playerCollider!;
    controller.computeColliderMovement(collider, this.displacement);
    controller.computedMovement(this.displacement);
    this.next.x = transform.x + this.displacement.x; this.next.y = transform.y + this.displacement.y; this.next.z = transform.z + this.displacement.z;
    this.physics.playerBody!.setNextKinematicTranslation(this.next);
    if (!enabled) return;
    const aim = input.aim;
    const aiming = aim && (input.left.held || input.right.held || input.left.down || input.right.down);
    if (aiming && Math.hypot(aim.x, aim.z) > 0) transform.yaw = -Math.atan2(aim.z, aim.x);
    else if (magnitude > 0) {
      const target = -Math.atan2(z, x), delta = Math.atan2(Math.sin(target - transform.yaw), Math.cos(target - transform.yaw));
      transform.yaw += Math.sign(delta) * Math.min(Math.abs(delta), survivor.turnSpeed * FIXED_DT);
    }
  }
  reset(): void { this.velocity.x = this.velocity.z = 0; }
}
