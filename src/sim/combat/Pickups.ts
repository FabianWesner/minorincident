import { clearPickupPosition } from '../interact/PickupPlacement';
import { allyState } from '../outbreak/Allies';
import { l4 } from '../../data/l4';
import type { EntitySnapshot } from '../world/types';
import { action } from '../../data/actions/catalog';
import type { InputFrame, Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
/** Level-owned pickup entity. A dropped item arms only after the player leaves it, preventing swap loops. */
export class Pickups {
  constructor(private readonly world: SimWorld) {}
  spawn(actionId: string, position: Vec2, dropped = false, options: { retain?: boolean; interactTicks?: number; surfaceY?: number; survivorOnly?: boolean } = {}): number {
    action(actionId);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) throw new RangeError('Invalid pickup position');
    const support = this.world.districts?.groundHeight(position.x, position.z) ?? 0;
    if (!dropped && (options.surfaceY === undefined || Math.abs(options.surfaceY - support) < .05)) {
      position = clearPickupPosition(this.world, position);
      options = { ...options, surfaceY: this.world.districts?.groundHeight(position.x, position.z) ?? 0 };
    }
    const entity = this.world.entities.create({ kind: 'pickup', archetype: actionId, faction: 'neutral', health: { current: 1, max: 1 }, transform: { x: position.x, y: (options.surfaceY ?? 0) + 0.15, z: position.z, yaw: 0 }, pickup: { actionId, armed: !dropped, ...(dropped ? { dropped: true } : {}), ...options } });
    this.world.spatial.set(entity.id, position.x, position.z); return entity.id;
  }
  /** One ground firearm per living follower. Mission/courier pickups and discarded courier weapons remain reserved. */
  armSurvivor(e: EntitySnapshot): boolean {
    const c = e.civilian;
    if (!c?.survivor || c.survivor.mode !== 'follow' || c.ally || e.hidden || e.infection || e.health.current <= 0 || !['calm', 'alarmed', 'flee', 'hide'].includes(c.state)) return false;
    for (const item of this.world.entities.iterate()) {
      const p = item.pickup;
      if (!p || !('actionId' in p) || !p.armed || p.dropped || p.retain || p.interactTicks || action(p.actionId).category !== 'ranged' || p.actionId === 'weapon.rocket-launcher') continue;
      if (Math.hypot(e.transform.x - item.transform.x, e.transform.z - item.transform.z) > 2 || Math.abs(e.transform.y - .7 - (p.surfaceY ?? 0)) > .6 || !this.world.infected!.nav.visible(e.transform, item.transform, .2)) continue;
      const pistol = /handgun|pistol/.test(p.actionId), hunting = /hunting-rifle|shotgun/.test(p.actionId);
      const weapon = pistol ? 'pistol' : p.actionId === 'weapon.shotgun' ? 'shotgun' : hunting ? 'hunting-rifle' : 'rifle';
      const gun = pistol ? l4.civilians.pistol : hunting ? l4.civilians.rifle : l4.soldiers.rifle;
      c.ally = { ...allyState('civilian'), actionId: p.actionId, weapon, gun: { ...gun, rangeM: action(p.actionId).range }, engaged: true };
      if (e.appearance) e.appearance.handProp = weapon;
      c.story = null; c.survivor.cover = false;
      this.world.entities.remove(item.id); this.world.spatial.delete(item.id);
      return true;
    }
    return false;
  }
  update(frame?: InputFrame): void {
    const player = this.world.entities.get(1)!; if (player.health.current <= 0) return;
    for (const entity of this.world.entities.iterate()) {
      const pickup = entity.pickup; if (!pickup || !('actionId' in pickup) || pickup.survivorOnly) continue;
      const distance = Math.hypot(player.transform.x - entity.transform.x, player.transform.z - entity.transform.z);
      if (!pickup.armed) { if (distance > 0.8) pickup.armed = true; continue; }
      if (pickup.interactTicks && frame?.moveTarget && Math.hypot(frame.moveTarget.x - entity.transform.x, frame.moveTarget.z - entity.transform.z) < 1.2) pickup.requested = true;
      // A shelf behind a rail can't be stood next to: a clicked shelf pickup is reachable from 2.2 m (PO 10-15 L5 shotgun).
      const reach = !pickup.interactTicks ? 0.6 : pickup.requested && (pickup.surfaceY ?? 0) > 0 ? 2.2 : 1.5;
      // Arrived for a clicked pickup: stop the click route here instead of walking on (the L5 route to the shelf ends at the cellar exit).
      if (pickup.requested && distance <= reach && this.world.controls.moveTarget) { this.world.controls.reset(); continue; }
      if (distance > reach || (pickup.interactTicks && frame && Math.hypot(frame.move.x, frame.move.z) > 0)) { if (pickup.interactTicks) pickup.progress = 0; continue; }
      if (pickup.interactTicks) {
        // A click on (or right next to) the pickup counts as interacting: a shelf behind a rail keeps the courier more than 0.6 m away (PO 10-15 L5 shotgun).
        if (!pickup.progress && !frame?.interact && !pickup.requested && distance > 0.6) continue;
        pickup.progress = (pickup.progress ?? 0) + 1;
        if (pickup.progress < pickup.interactTicks) continue;
      }
      const combat = this.world.combat!, side = pickup.retain ? 'RIGHT' : combat.runner.loadout.state.selectedSide;
      const loadout = combat.runner.loadout;
      let replaced: string | null = null;
      if (pickup.retain) {
        const rack = loadout.state[side];
        let index = rack.rack.findIndex(s => s.id === pickup.actionId);
        if (index < 0) {
          combat.rackCapacity = Math.max(combat.rackCapacity, rack.rack.length + 1);
          index = rack.rack.length;
          loadout.collect(side, pickup.actionId, true);
        }
        combat.runner.loadout.state.selectedSide = side;
        combat.runner.loadout.state[side].index = index;
      } else replaced = loadout.collect(side, pickup.actionId);
      delete combat.runner.running[side];
      this.world.entities.remove(entity.id); this.world.spatial.delete(entity.id);
      if (replaced) this.spawn(replaced, entity.transform, true);
      this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, sourceId: 1, pickupId: entity.id, side, actionId: pickup.actionId, replaced });
    }
  }
}
