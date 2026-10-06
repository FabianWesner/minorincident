import * as RAPIER from '@dimforge/rapier3d-compat';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
export const lightObstacles = ['fence', 'cone', 'barricade', 'trash-can', 'mailbox'] as const;
export const heavyObstacles = ['jersey-barrier', 'wall', 'truck'] as const;
export type ObstacleKind = typeof lightObstacles[number] | typeof heavyObstacles[number];
interface Obstacle { entity: EntitySnapshot; collider: RAPIER.Collider; halfX: number; halfZ: number; light: boolean; broken: boolean }
/** Light obstacles have a fixed 24-body debris pool; heavy blockers remain Rapier geometry. */
export class Obstacles {
  readonly items: Obstacle[] = [];
  readonly debris: { body: RAPIER.RigidBody; expires: number }[] = [];
  private nextDebris = 0;
  constructor(private readonly world: SimWorld) {}
  spawn(kind: ObstacleKind, pos: { x: number; z: number }): number {
    if (![...lightObstacles, ...heavyObstacles].includes(kind) || ![pos.x, pos.z].every(Number.isFinite)) throw new RangeError('Invalid vehicle obstacle');
    const light = (lightObstacles as readonly string[]).includes(kind), halfX = kind === 'truck' ? 3 : kind === 'wall' ? .3 : .35, halfZ = kind === 'wall' ? 4 : kind === 'fence' || kind === 'barricade' ? 1.2 : .35;
    const entity = this.world.entities.create({ kind: 'obstacle', archetype: `obstacle.${kind}`, transform: { ...pos, y: .5, yaw: 0 }, health: { current: 1, max: 1 }, faction: 'neutral' });
    const collider = this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(halfX, .5, halfZ).setTranslation(pos.x, .5, pos.z));
    this.items.push({ entity, collider, halfX, halfZ, light, broken: false });
    this.world.events.emit({ type: 'world.blocker.changed', tick: this.world.tick, id: entity.id, blocked: true, wall: { ...pos, y: .5, halfX, halfY: .5, halfZ } }); return entity.id;
  }
  break(item: Obstacle, velocity: RAPIER.Vector, tick: number): void {
    this.world.events.emit({ type: 'world.blocker.changed', tick, id: item.entity.id, blocked: false, wall: { ...item.entity.transform, halfX: item.halfX, halfY: .5, halfZ: item.halfZ } });
    item.broken = true; item.entity.health.current = 0; item.collider.setEnabled(false);
    for (let i = 0; i < 3; i++) {
      let debris = this.debris[this.nextDebris];
      if (!debris) {
        const body = this.world.physics.world!.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true));
        this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(.12, .12, .12).setMass(2), body);
        debris = { body, expires: 0 }; this.debris.push(debris);
      }
      const p = item.entity.transform;
      debris.body.setEnabled(true); debris.body.setTranslation({ x: p.x, y: .6 + i * .15, z: p.z + (i - 1) * .2 }, true);
      debris.body.setLinvel({ x: velocity.x * .5, y: 2 + i, z: velocity.z * .5 + i - 1 }, true); debris.body.setAngvel({ x: i + 1, y: 2, z: -1 }, true); debris.expires = tick + 300;
      this.nextDebris = (this.nextDebris + 1) % 24;
    }
    this.world.events.emit({ type: 'vehicle.obstacle-broken', tick, targetId: item.entity.id });
  }
  update(tick: number): void { for (const d of this.debris) if (d.expires && tick >= d.expires) { d.body.setEnabled(false); d.expires = 0; } }
  /** Rebind E12-restored records/colliders; tier changes have already freed native handles. */
  rebuild(worldReset = false): void {
    const items = [...this.items];
    if (!worldReset) this.dispose(); else this.items.length = this.debris.length = 0;
    this.nextDebris = 0;
    for (const item of items) {
      const entity = this.world.entities.get(item.entity.id); if (!entity) continue;
      const collider = this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(item.halfX, .5, item.halfZ).setTranslation(entity.transform.x, .5, entity.transform.z));
      const broken = entity.health.current <= 0; collider.setEnabled(!broken);
      this.items.push({ ...item, entity, collider, broken });
    }
  }
  dispose(): void { for (const d of this.debris) this.world.physics.world!.removeRigidBody(d.body); for (const o of this.items) this.world.physics.world!.removeCollider(o.collider, false); this.items.length = this.debris.length = 0; }
}
