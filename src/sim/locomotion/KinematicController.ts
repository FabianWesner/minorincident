import * as RAPIER from '@dimforge/rapier3d-compat';
import { faceMotion, motionResponse, resetResponse, respond, playerMotionLimits } from './MotionResponse';
import { FIXED_DT } from '../../core/Clock';
import { survivor } from '../../data/survivor';
import type { InputFrame } from '../../input/InputFrame';
import type { Physics } from '../../physics/Physics';
import type { NavGrid } from '../ai/NavGrid';
import type { Transform } from '../world/types';

/** Soft crowd circles have no Rapier body. E07 supplies live transform references. */
export interface CrowdObstacle { transform: { x: number; z: number; y?: number }; radius: number }
/** Rapier sweep/slide with bounded acceleration. Intent runs before physics, pose after it (Bruno Player.js). */
export class KinematicController {
  readonly response = motionResponse();
  private navigating = false;
  readonly velocity = { x: 0, z: 0 };
  readonly displacement = { x: 0, y: 0, z: 0 };
  private readonly next = { x: 0, y: 0, z: 0 };
  navigationGrid: NavGrid | null = null;
  /** Confined authored floors also bound keyboard/joystick motion, including crowd push. */
  movementMask: ((x: number, z: number) => boolean) | null = null;
  speedScale = 1;
  private clearance = .005;
  private fallSpeed = 0;
  crowd: readonly CrowdObstacle[] = [];
  /** Solid props without a static collider (the parked bicycle): always pushed out of, at up to 4 m/s. */
  props: readonly CrowdObstacle[] = [];
  groundHeight: ((x: number, z: number) => number) | null = null;
  /** L7's raised Northgate road must continue supporting the courier during Alpha stun. */
  supportWhenDisabled = false;
  /**
   * Keyboard/joystick corner slip (r2-bike): a head-on push into the edge of a static box or post that ends within
   * `cornerSlipReach` sidesteps along the face at walking pace until the way ahead is clear, so the courier rounds lot
   * corners and lamp posts instead of stopping dead. Off while riding (the bicycle steers its own heading).
   */
  cornerSlip = true;
  private readonly slipShape = new RAPIER.Capsule(survivor.height / 2 - survivor.radius, survivor.radius);
  private readonly slipRotation = { x: 0, y: 0, z: 0, w: 1 };
  private readonly slipDisplacement = { x: 0, y: 0, z: 0 };
  /** Pose and intent of the last search that found no clear side: pushing into a long wall searches once, not every tick. */
  private readonly slipMiss = { x: NaN, z: NaN, dx: 0, dz: 0 };
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
    // Keep the resting contact intent, but accelerate unsupported falls. A
    // constant 2 cm/tick let the courier float from the gun deck onto the L10
    // console several metres away; the same Rapier sweep still owns landing.
    this.fallSpeed -= this.physics.world!.gravity.y * FIXED_DT;
    this.displacement.y = -Math.max(.02, this.fallSpeed * FIXED_DT);
    let hover = -Infinity;
    if (enabled || this.supportWhenDisabled) {
      // Thin paving edges can defeat Rapier autostep at low joystick speeds.
      // Start a bounded upward sweep at the capsule's leading foot, using the
      // same GLB support tops as NPC grounding. The sweep still tests all solids.
      const supportX = transform.x + this.displacement.x + x * (survivor.radius + .02), supportZ = transform.z + this.displacement.z + z * (survivor.radius + .02);
      const support = (px: number, pz: number) => this.groundHeight?.(px, pz) ?? this.physics.floorHeight(px, pz);
      // Probe the whole leading footprint: a thin raised curb can lie between
      // the centre and the leading toe, above the paving sampled at the toe.
      const ground = Math.max(support(supportX, supportZ), support(transform.x + this.displacement.x, transform.z + this.displacement.z), support((supportX + transform.x) / 2, (supportZ + transform.z) / 2));
      // The wanted hover flips with the input mode (a held target-attack alternates navigation on and off per tick): it
      // rises at once but settles back slowly, so the capsule never follows it up and down.
      const wanted = ground > .01 || navigation ? .02 : magnitude > 0 ? .01 : .005;
      this.clearance = wanted > this.clearance ? wanted : Math.max(wanted, this.clearance - .06 * FIXED_DT);
      hover = ground + survivor.height / 2 + this.clearance - transform.y;
      this.displacement.y = Math.max(this.displacement.y, Math.min(.06, hover));
      if (hover >= -.02) this.fallSpeed = 0;
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
      // A crowd on the road below a bridge cannot press against the capsule on its deck.
      if (neighbor.transform.y !== undefined && Math.abs(transform.y - neighbor.transform.y) >= survivor.height) continue;
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
        // Navigation feeds actual displacement back into its response. Taking a quarter of that
        // already-slowed velocity compounds the resistance each tick, down to the escape crawl.
        // Retain a quarter of the requested pace, bounded by the current acceleration ramp.
        const pace = survivor.speed * this.speedScale * magnitude;
        const minimum = Math.max(survivor.minimumEscapeSpeed, Math.min(Math.hypot(this.velocity.x, this.velocity.z), pace * .25)) * FIXED_DT;
        if (forward < minimum) { this.displacement.x += x * (minimum - forward); this.displacement.z += z * (minimum - forward); }
      }
    }
    if (navigation && this.navigationGrid && transform.y < this.physics.floorHeight(transform.x, transform.z) + survivor.height / 2 + .06) {
      // Keep coast at ground-level route corners inside the grid clearance.
      // Elevated supports need the 3D capsule sweep: the grid has no height.
      this.next.x = transform.x; this.next.z = transform.z;
      this.navigationGrid.move(this.next, this.displacement.x, this.displacement.z, survivor.radius, true);
      this.displacement.x = this.next.x - transform.x; this.displacement.z = this.next.z - transform.z;
    }
    if (this.movementMask) {
      const x = transform.x + this.displacement.x, z = transform.z + this.displacement.z;
      if (!this.movementMask(x, z)) {
        // Slide along the room edge so a diagonal key does not strand the
        // courier outside the floor and beyond every valid route start.
        if (!this.movementMask(x, transform.z)) this.displacement.x = 0;
        if (!this.movementMask(transform.x + this.displacement.x, z)) this.displacement.z = 0;
      }
    }
    const controller = this.physics.characterController!, collider = this.physics.playerCollider!;
    const wantX = this.displacement.x, wantY = this.displacement.y, wantZ = this.displacement.z;
    controller.computeColliderMovement(collider, this.displacement, undefined, collider.collisionGroups());
    controller.computedMovement(this.displacement);
    if (enabled && this.cornerSlip && !navigation && magnitude > 0) this.slip(x, z, wantX, wantY, wantZ, transform);
    if (controller.computedGrounded()) this.fallSpeed = 0;
    // Snap-to-ground pulls a capsule hovering above its resting height straight back down, and the next tick lifts it again:
    // a 1.5 cm bob every tick (Scene Lab qa-courier-attack-bat). Hold the hover instead of snapping out of it.
    if (hover > this.displacement.y && hover < .06) this.displacement.y = hover;
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
  /**
   * Head-on block by a static solid: sidestep (perpendicular to the intent) toward the nearer clear side, if a capsule
   * offset by at most `cornerSlipReach` both reaches that offset and has a free way ahead. Long walls never clear, so
   * pushing straight into them still stops; the second controller pass keeps every solid between her and the slip.
   */
  private slip(x: number, z: number, wantX: number, wantY: number, wantZ: number, transform: Transform): void {
    const want = x * wantX + z * wantZ;
    if (want <= 1e-4 || x * this.displacement.x + z * this.displacement.z > want * .35) return;
    const controller = this.physics.characterController!, collider = this.physics.playerCollider!, world = this.physics.world!;
    // Only static geometry: crates, vehicles and bodies keep their pushes and contacts.
    let hit: RAPIER.CharacterCollision | null = null;
    for (let i = 0; i < controller.numComputedCollisions(); i++) {
      const c = controller.computedCollision(i);
      if (!c?.collider) continue;
      const parent = c.collider.parent();
      if (parent && !parent.isFixed()) continue;
      const nx = c.normal1.x, nz = c.normal1.z, nl = Math.hypot(nx, nz);
      // A mostly horizontal contact normal along her intent: the solid is straight ahead, not beside her.
      if (nl > .5 && Math.abs(nx * x + nz * z) / nl > .6) { hit = c; break; }
    }
    if (!hit) return;
    const at = collider.translation(), tx = -z, tz = x, flags = RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, miss = this.slipMiss;
    if (Math.abs(miss.x - at.x) + Math.abs(miss.z - at.z) < 1e-4 && miss.dx === x && miss.dz === z) return;
    const origin = { x: at.x - x * .03, y: at.y + .2, z: at.z - z * .03 }, groups = collider.collisionGroups();
    const lateral = (hit.witness1.x - at.x) * tx + (hit.witness1.z - at.z) * tz;
    const sides = lateral > 0 ? [-1, 1] : [1, -1];
    const free = (px: number, pz: number, dx: number, dz: number, distance: number) => !world.castShape({ x: px, y: origin.y, z: pz }, this.slipRotation, { x: dx, y: 0, z: dz }, this.slipShape, 0, distance, true, flags, groups, collider);
    for (let offset = .08; offset <= KinematicController.cornerSlipReach + 1e-6; offset += .08) for (const side of sides) {
      const ox = origin.x + tx * side * offset, oz = origin.z + tz * side * offset;
      if (!free(origin.x, origin.z, tx * side, tz * side, offset) || !free(ox, oz, x, z, .5)) continue;
      if (this.movementMask && !this.movementMask(transform.x + tx * side * Math.min(offset, want), transform.z + tz * side * Math.min(offset, want))) continue;
      const step = Math.min(offset + .02, want);
      this.slipDisplacement.x = tx * side * step; this.slipDisplacement.y = wantY; this.slipDisplacement.z = tz * side * step;
      controller.computeColliderMovement(collider, this.slipDisplacement, undefined, groups);
      const moved = controller.computedMovement();
      this.displacement.x = moved.x; this.displacement.y = moved.y; this.displacement.z = moved.z;
      return;
    }
    miss.x = at.x; miss.z = at.z; miss.dx = x; miss.dz = z;
  }
  /** Widest sidestep in metres (about two body widths): posts, bins and lot or building corners, never along a whole wall. */
  static readonly cornerSlipReach = 1.44;
  reset(): void { this.slipMiss.x = NaN; this.clearance = .005; this.fallSpeed = 0; this.velocity.x = this.velocity.z = 0; resetResponse(this.response); this.navigating = false; }
}
