// Adapted from folio-2025 by Bruno Simon (MIT).
import * as RAPIER from '@dimforge/rapier3d-compat';
import { survivor } from '../data/survivor';
import { FIXED_DT } from '../core/Clock';
import type { Lifecycle } from '../core/Lifecycle';
import type { Aabb } from '../levels/districts/types';
import type { ScenarioDefinition } from '../levels/loader';

let initialized: Promise<void> | undefined;
/** Identical pinned WASM build in Node and the browser. Owns all native allocations. */
export class Physics implements Lifecycle {
  world: RAPIER.World | null = null;
  private ground: ScenarioDefinition['ground'] | null = null;
  playerBody: RAPIER.RigidBody | null = null;
  playerCollider: RAPIER.Collider | null = null;
  characterController: RAPIER.KinematicCharacterController | null = null;
  async init(): Promise<void> { await (initialized ??= RAPIER.init()); }
  load(scenario: ScenarioDefinition): void {
    this.reset();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    this.ground = scenario.ground;
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(scenario.ground.center?.x ?? 0, -0.1, scenario.ground.center?.z ?? 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(scenario.ground.width / 2, 0.1, scenario.ground.depth / 2), ground);
    const p = { ...scenario.player };
    // A grounded capsule needs the support clearance above its sweep controller skin.
    if (scenario.survivor && p.y >= survivor.height / 2 - .001 && p.y < survivor.height / 2 + .005) p.y = survivor.height / 2 + .005;
    this.playerBody = this.world.createRigidBody((scenario.survivor ? RAPIER.RigidBodyDesc.kinematicPositionBased() : RAPIER.RigidBodyDesc.dynamic()).setTranslation(p.x, p.y, p.z).lockRotations());
    this.playerCollider = this.world.createCollider((scenario.survivor ? RAPIER.ColliderDesc.capsule(survivor.height / 2 - survivor.radius, survivor.radius) : RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)).setFriction(0).setCollisionGroups(0x00010001), this.playerBody);
    for (const wall of scenario.walls ?? []) this.world.createCollider(RAPIER.ColliderDesc.cuboid(wall.halfX, wall.halfY, wall.halfZ).setTranslation(wall.x, wall.y, wall.z));
    if (scenario.survivor) { this.characterController = this.world.createCharacterController(0.005); this.characterController.setSlideEnabled(true); this.characterController.enableAutostep(.4, .2, true); this.characterController.enableSnapToGround(0.1); }
    // Populate query structures before the first character sweep.
    if (scenario.survivor) this.world.step();
  }
  /** Fixture support is finite; walking beyond its edge must still fall. */
  floorHeight(x: number, z: number): number {
    const g = this.ground;
    return g && Math.abs(x - (g.center?.x ?? 0)) <= g.width / 2 && Math.abs(z - (g.center?.z ?? 0)) <= g.depth / 2 ? 0 : -Infinity;
  }
  /** Static layout/blocker AABBs become fixed Rapier colliders at level load only. */
  addStatic(aabb: Aabb, origin: [number,number]): number {
    const half = aabb.max.map((v,i)=>(v-aabb.min[i])/2);
    return this.world!.createCollider(RAPIER.ColliderDesc.cuboid(half[0],half[1],half[2]).setTranslation((aabb.min[0]+aabb.max[0])/2+origin[0],(aabb.min[1]+aabb.max[1])/2,(aabb.min[2]+aabb.max[2])/2+origin[1])).handle;
  }
  update(): void { if (this.world) { this.world.timestep = FIXED_DT; this.world.step(); } }
  /** E11 removable doors/props. The caller owns the handle until removed or reset. */
  addBlocker(wall: NonNullable<ScenarioDefinition['walls']>[number]): number {
    return this.world!.createCollider(RAPIER.ColliderDesc.cuboid(wall.halfX, wall.halfY, wall.halfZ).setTranslation(wall.x, wall.y, wall.z)).handle;
  }
  removeBlocker(handle: number): void { const collider = this.world!.getCollider(handle); if (collider) this.world!.removeCollider(collider, true); }
  reset(): void { this.ground = null; this.characterController = null; this.playerCollider = null; this.playerBody = null; this.world?.free(); this.world = null; }
  dispose(): void { this.reset(); }
  get bodyCount(): number { return this.world?.bodies.len() ?? 0; }
  get colliderCount(): number { return this.world?.colliders.len() ?? 0; }
}
