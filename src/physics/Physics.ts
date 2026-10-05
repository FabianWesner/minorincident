// Adapted from folio-2025 by Bruno Simon (MIT).
import * as RAPIER from '@dimforge/rapier3d-compat';
import { FIXED_DT } from '../core/Clock';
import type { Lifecycle } from '../core/Lifecycle';
import type { ScenarioDefinition } from '../levels/loader';

let initialized: Promise<void> | undefined;
/** Identical pinned WASM build in Node and the browser. Owns all native allocations. */
export class Physics implements Lifecycle {
  world: RAPIER.World | null = null;
  playerBody: RAPIER.RigidBody | null = null;
  async init(): Promise<void> { await (initialized ??= RAPIER.init()); }
  load(scenario: ScenarioDefinition): void {
    this.reset();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
    const ground = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.1, 0));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(scenario.ground.width / 2, 0.1, scenario.ground.depth / 2), ground);
    const p = scenario.player;
    this.playerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).lockRotations());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5).setFriction(0), this.playerBody);
  }
  update(): void { if (this.world) { this.world.timestep = FIXED_DT; this.world.step(); } }
  reset(): void { this.playerBody = null; this.world?.free(); this.world = null; }
  dispose(): void { this.reset(); }
  get bodyCount(): number { return this.world?.bodies.len() ?? 0; }
  get colliderCount(): number { return this.world?.colliders.len() ?? 0; }
}
