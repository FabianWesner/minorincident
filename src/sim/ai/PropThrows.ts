import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
/** Borrowed E26 medium-prop body. E26 owns its lifetime and visual synchronization. */
export interface ThrowableProp { id: number; body: RigidBody; mass: number; class: 'light' | 'medium' | 'heavy'; radius: number }
interface Flight { prop: ThrowableProp; sourceId: number; attackId: number; expires: number }
/** E07 only selects/launches borrowed props; physics and momentum damage use the existing world. */
export class PropThrows {
  readonly props: ThrowableProp[] = [];
  readonly flights: Flight[] = [];
  constructor(private readonly world: SimWorld) {}
  nearestMedium(source: EntitySnapshot): ThrowableProp | undefined {
    let nearest: ThrowableProp | undefined, distance = 6;
    for (const prop of this.props) {
      if (prop.class !== 'medium' || this.flights.some((flight) => flight.prop === prop)) continue;
      const position = prop.body.translation(), d = Math.hypot(position.x - source.transform.x, position.z - source.transform.z);
      if (d < distance) { distance = d; nearest = prop; }
    }
    return nearest;
  }
  launch(source: EntitySnapshot, attackId: number): boolean {
    const prop = this.nearestMedium(source); if (!prop) return false;
    const target = this.world.entities.get(1)!.transform, p = source.transform;
    const dx = target.x - p.x, dz = target.z - p.z, distance = Math.hypot(dx, dz), time = Math.max(0.25, distance / 12), y = 2;
    prop.body.setTranslation({ x: p.x, y, z: p.z }, true);
    prop.body.setLinvel({ x: dx / time, y: (target.y - y + 0.5 * 9.81 * time * time) / time, z: dz / time }, true);
    this.flights.push({ prop, sourceId: source.id, attackId, expires: this.world.tick + Math.ceil((time + 1) * 60) });
    this.world.events.emit({ type: 'infected.prop-thrown', tick: this.world.tick, sourceId: source.id, propId: prop.id, attackId }); return true;
  }
  update(): void {
    const player = this.world.entities.get(1)!;
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const flight = this.flights[i], p = flight.prop.body.translation(), v = flight.prop.body.linvel();
      const controller = this.world.physics.characterController;
      let contact = false;
      if (controller) for (let c = 0; c < controller.numComputedCollisions(); c++) if (controller.computedCollision(c)?.collider?.parent()?.handle === flight.prop.body.handle) contact = true;
      if (contact || Math.hypot(p.x - player.transform.x, p.y - player.transform.y, p.z - player.transform.z) < flight.prop.radius + 0.6) {
        const speed = Math.hypot(v.x, v.y, v.z), damage = Math.min(80, flight.prop.mass * speed * speed * 0.005);
        const amount = this.world.combat!.damage.apply({ sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, actionId: 'infected.gorilla.prop', origin: p, direction: { x: v.x / Math.max(0.01, speed), z: v.z / Math.max(0.01, speed) }, base: damage, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: flight.sourceId, targetId: 1, attackId: flight.attackId, special: 'prop-throw', amount }); this.flights.splice(i, 1);
      } else if (this.world.tick >= flight.expires) this.flights.splice(i, 1);
    }
  }
}
