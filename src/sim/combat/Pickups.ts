import { action } from '../../data/actions/catalog';
import type { Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
/** Level-owned pickup entity. A dropped item arms only after the player leaves it, preventing swap loops. */
export class Pickups {
  constructor(private readonly world: SimWorld) {}
  spawn(actionId: string, position: Vec2, dropped = false): number {
    action(actionId);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) throw new RangeError('Invalid pickup position');
    const entity = this.world.entities.create({ kind: 'pickup', archetype: actionId, faction: 'neutral', health: { current: 1, max: 1 }, transform: { x: position.x, y: 0.15, z: position.z, yaw: 0 }, pickup: { actionId, armed: !dropped } });
    this.world.spatial.set(entity.id, position.x, position.z); return entity.id;
  }
  update(): void {
    const player = this.world.entities.get(1)!; if (player.health.current <= 0) return;
    for (const entity of this.world.entities.iterate()) {
      const pickup = entity.pickup; if (!pickup) continue;
      const distance = Math.hypot(player.transform.x - entity.transform.x, player.transform.z - entity.transform.z);
      if (!pickup.armed) { if (distance > 0.8) pickup.armed = true; continue; }
      if (distance > 0.6) continue;
      const combat = this.world.combat!, side = combat.runner.loadout.state.selectedSide;
      const replaced = combat.runner.loadout.collect(side, pickup.actionId);
      delete combat.runner.running[side];
      this.world.entities.remove(entity.id); this.world.spatial.delete(entity.id);
      if (replaced) this.spawn(replaced, entity.transform, true);
      this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, sourceId: 1, pickupId: entity.id, side, actionId: pickup.actionId, replaced });
    }
  }
}
