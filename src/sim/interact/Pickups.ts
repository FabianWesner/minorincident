import { action } from '../../data/actions/fixtures';
import type { Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
export const pickupKinds = ['medkit', 'soda', 'energy-drink', 'throwable', 'weapon', 'item'] as const;
export type PickupKind = typeof pickupKinds[number];
export interface Pickup { kind: PickupKind; item: string | null; radius: number; collected: boolean }
/** Collection is a one-shot sim transaction, with health/charge caps and respawn-safe inventory. */
export class Pickups {
  constructor(private readonly world: SimWorld) {}
  spawn(kind: PickupKind, pos: Vec2, item?: string): number {
    if (!pickupKinds.includes(kind) || ![pos.x, pos.z].every(Number.isFinite) || ((kind === 'weapon' || kind === 'item') && !item)) throw new RangeError('Invalid pickup');
    if (kind === 'weapon') action(item!);
    const e = this.world.entities.create({ kind: 'pickup', archetype: `pickup.${kind}`, faction: 'environment', health: { current: 1, max: 1 }, transform: { ...pos, y: .3, yaw: 0 }, pickup: { kind, item: item ?? null, radius: .9, collected: false } });
    this.world.spatial.set(e.id, pos.x, pos.z); return e.id;
  }
  update(): void {
    const player = this.world.entities.get(1)!; if (player.health.current <= 0) return;
    for (const e of this.world.entities.iterate()) {
      const p = e.pickup;
      if (!p || p.collected || (player.transform.x - e.transform.x) ** 2 + (player.transform.z - e.transform.z) ** 2 > p.radius ** 2) continue;
      if (p.kind === 'medkit' || p.kind === 'soda') {
        if (player.health.current >= player.health.max) continue;
        player.health.current = Math.min(player.health.max, player.health.current + player.health.max * (p.kind === 'medkit' ? .5 : .15));
      } else if (p.kind === 'energy-drink') player.speedBuff = { multiplier: 1.25, until: this.world.tick + 480 };
      else if (p.kind === 'item') this.world.interactables!.giveItem(p.item!);
      else {
        const loadout = this.world.combat?.runner.loadout; if (!loadout) continue;
        if (p.kind === 'weapon') loadout.pickup(p.item!);
        else {
          let refilled = false;
          for (const side of ['LEFT', 'RIGHT'] as const) for (const slot of loadout.state[side].rack) {
            const def = action(slot.id);
            if (def.category === 'throwable' && slot.charges < def.charges) { slot.charges++; if (slot.charges === def.charges) slot.nextCharge = 0; refilled = true; }
          }
          if (!refilled) continue;
        }
      }
      p.collected = true; this.world.spatial.delete(e.id);
      this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, id: e.id, kind: p.kind, item: p.item });
    }
  }
}
