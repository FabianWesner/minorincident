import * as RAPIER from '@dimforge/rapier3d-compat';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
export const lightObstacles = ['fence', 'cone', 'barricade', 'trash-can', 'mailbox'] as const;
export const heavyObstacles = ['jersey-barrier', 'wall', 'truck'] as const;
export type ObstacleKind = typeof lightObstacles[number] | typeof heavyObstacles[number];
interface Obstacle { entity: EntitySnapshot; collider: RAPIER.Collider; body?: RAPIER.RigidBody; halfX: number; halfZ: number; light: boolean; broken: boolean; /** r32-l9fun: thrown by an L9 Thrower, no contact until it lands. */ airborne?: boolean }
/** Light obstacles have a fixed 24-body debris pool; heavy blockers remain Rapier geometry. */
export class Obstacles {
  readonly items: Obstacle[] = [];
  readonly debris: { body: RAPIER.RigidBody; expires: number }[] = [];
  private nextDebris = 0;
  constructor(private readonly world: SimWorld) {}
  private bind(entity: EntitySnapshot, kind: ObstacleKind): void {
    const light = (lightObstacles as readonly string[]).includes(kind), halfX = kind === 'truck' ? 3 : kind === 'jersey-barrier' ? 1.5 : kind === 'wall' ? .3 : .35, halfZ = kind === 'wall' ? 4 : kind === 'truck' || kind === 'fence' || kind === 'barricade' ? 1.2 : .35;
    const collider = this.world.physics.world!.createCollider(RAPIER.ColliderDesc.cuboid(halfX, .5, halfZ).setTranslation(entity.transform.x, .5, entity.transform.z));
    const broken = entity.health.current <= 0; collider.setEnabled(!broken);
    this.items.push({ entity, collider, halfX, halfZ, light, broken });
  }
  spawn(kind: ObstacleKind, pos: { x: number; z: number }): number {
    if (![...lightObstacles, ...heavyObstacles].includes(kind) || ![pos.x, pos.z].every(Number.isFinite)) throw new RangeError('Invalid vehicle obstacle');
    const entity = this.world.entities.create({ kind: 'obstacle', archetype: `obstacle.${kind}`, transform: { ...pos, y: .5, yaw: 0 }, health: { current: 1, max: 1 }, faction: 'neutral' });
    this.bind(entity, kind);
    const { halfX, halfZ } = this.items[this.items.length - 1];
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
  /** Vehicle impacts throw a prop clear but keep its identity, model and collider for the rest of the level. */
  ram(item: Obstacle, velocity: RAPIER.Vector, tick: number): void {
    if (item.broken || item.body) return;
    const p = item.entity.transform;
    this.world.events.emit({ type: 'world.blocker.changed', tick, id: item.entity.id, blocked: false, wall: { ...p, halfX: item.halfX, halfY: .5, halfZ: item.halfZ } });
    this.world.physics.world!.removeCollider(item.collider, false);
    const world = this.world.physics.world!, body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).setTranslation(p.x, .5, p.z).setRotation({ x: 0, y: Math.sin(p.yaw / 2), z: 0, w: Math.cos(p.yaw / 2) }));
    const mass = item.light ? 8 : 55;
    const collider = world.createCollider(RAPIER.ColliderDesc.cuboid(item.halfX, .5, item.halfZ).setMass(mass), body);
    body.setLinvel({ x: Math.max(-12, Math.min(12, velocity.x * .65)), y: 2.2, z: Math.max(-12, Math.min(12, velocity.z * .65)) }, true);
    body.setAngvel({ x: velocity.z * .08, y: velocity.x * .04, z: -velocity.x * .08 }, true);
    item.body = body; item.collider = collider; item.airborne = true;
  }
  /** r32-l9fun: a thrown obstacle has no collider or contact until it lands. */
  launch(id: number, airborne: boolean): void {
    const item = this.items.find(o => o.entity.id === id); if (!item || item.broken) return;
    item.airborne = airborne || undefined; item.collider.setEnabled(!airborne);
    if (!airborne) item.collider.setTranslation({ x: item.entity.transform.x, y: .5, z: item.entity.transform.z });
  }
  /** A thrown obstacle that lands on a hull bursts into debris (r32-l9fun), whatever its weight. */
  smash(id: number, velocity: RAPIER.Vector, tick: number): void {
    const item = this.items.find(o => o.entity.id === id); if (item && !item.broken) this.break(item, velocity, tick);
  }
  update(tick: number): void {
    for (const item of this.items) {
      const body = item.body; if (!body?.isValid() || !body.isEnabled()) continue;
      const p = body.translation(), r = body.rotation();
      Object.assign(item.entity.transform, { x: p.x, y: p.y, z: p.z, yaw: 2 * Math.atan2(r.y, r.w) });
      if (!item.airborne || Math.hypot(body.linvel().x, body.linvel().y, body.linvel().z) > .25 || Math.hypot(body.angvel().x, body.angvel().y, body.angvel().z) > .25 || p.y > .65) continue;
      item.airborne = undefined; body.setLinvel({ x: 0, y: 0, z: 0 }, true); body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      this.world.events.emit({ type: 'world.blocker.changed', tick, id: item.entity.id, blocked: true, wall: { ...item.entity.transform, halfX: item.halfX, halfY: .5, halfZ: item.halfZ } });
    }
    for (const d of this.debris) if (d.expires && tick >= d.expires) { d.body.setEnabled(false); d.expires = 0; }
  }
  /** Rebind E12-restored records/colliders; tier changes have already freed native handles. */
  rebuild(worldReset = false): void {
    if (!worldReset) this.dispose(); else this.items.length = this.debris.length = 0;
    this.nextDebris = 0;
    for (const entity of this.world.entities.iterate()) if (entity.kind === 'obstacle') {
      const kind = entity.archetype.replace(/^obstacle\./, '') as ObstacleKind;
      if ([...lightObstacles, ...heavyObstacles].includes(kind)) this.bind(entity, kind);
    }
  }
  dispose(): void { for (const d of this.debris) this.world.physics.world!.removeRigidBody(d.body); for (const o of this.items) { if (o.body) this.world.physics.world!.removeRigidBody(o.body); else this.world.physics.world!.removeCollider(o.collider, false); } this.items.length = this.debris.length = 0; }
}
