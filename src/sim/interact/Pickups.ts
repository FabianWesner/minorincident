import { clearPickupPosition } from './PickupPlacement';
import { action } from '../../data/actions/catalog';
import type { Vec2 } from '../../input/InputFrame';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export const pickupKinds = ['medkit', 'soda', 'energy-drink', 'throwable', 'weapon', 'item'] as const;
export type PickupKind = typeof pickupKinds[number];
/** `amount`: fixed heal in HP (E21 medkits: +40); without it a medkit heals 50 % and a soda 15 % of max. */
export interface Pickup { kind: Exclude<PickupKind, 'weapon'>; item: string | null; radius: number; collected: boolean; amount?: number; reservedFor?: number }
/** Collection is a one-shot sim transaction, with health/charge caps and respawn-safe inventory. */
export class Pickups {
  constructor(private readonly world: SimWorld) {}
  spawn(kind: PickupKind, pos: Vec2, item?: string): number {
    if (!pickupKinds.includes(kind) || ![pos.x, pos.z].every(Number.isFinite) || ((kind === 'weapon' || kind === 'item') && !item)) throw new RangeError('Invalid pickup');
    if (kind === 'weapon') {
      if (!this.world.combat) throw new Error('Weapon pickups require combat');
      return this.world.combat.pickups.spawn(item!, pos);
    }
    pos = clearPickupPosition(this.world, pos);
    const e = this.world.entities.create({ kind: 'pickup', archetype: `pickup.${kind}`, faction: 'environment', health: { current: 1, max: 1 }, transform: { ...pos, y: .3 + (this.world.districts?.pavingHeight(pos.x, pos.z) ?? 0), yaw: 0 }, pickup: { kind, item: item ?? null, radius: .9, collected: false } });
    this.world.spatial.set(e.id, pos.x, pos.z); return e.id;
  }
  /** A live follower reserves nearby safe medicine; arbitration uses health fraction, then stable id.
   * Reservation lives on the pickup so checkpoint restores cannot leave a stale external claim. */
  seekSurvivorMedkit(survivor: EntitySnapshot): boolean {
    const distance = (a: EntitySnapshot, b: EntitySnapshot) => Math.hypot(a.transform.x - b.transform.x, a.transform.z - b.transform.z);
    const eligible = (e: EntitySnapshot) => !e.hidden && !e.infection && e.health.current > 0 && e.health.current / e.health.max < .7 && e.civilian?.survivor?.mode === 'follow';
    const safe = (e: EntitySnapshot) => !this.world.infected?.active.some(o => o.health.current > 0 && !o.hidden && !o.infected?.hidden && distance(o, e) <= 8);
    if (!eligible(survivor) || !safe(survivor)) return false;
    for (const pack of this.world.entities.iterate()) {
      const p = pack.pickup;
      if (!p || !('kind' in p) || p.kind !== 'medkit' || p.collected || distance(pack, survivor) > 8 || !safe(pack)) continue;
      let owner = p.reservedFor === undefined ? undefined : this.world.entities.get(p.reservedFor);
      if (!owner || !eligible(owner) || !safe(owner) || distance(owner, pack) > 8) {
        owner = undefined; delete p.reservedFor;
        for (const e of this.world.entities.iterate()) {
          if (!eligible(e) || distance(e, pack) > 8 || !safe(e)) continue;
          if (!owner || e.health.current / e.health.max < owner.health.current / owner.health.max ||
            e.health.current / e.health.max === owner.health.current / owner.health.max && e.id < owner.id) owner = e;
        }
        if (owner) p.reservedFor = owner.id;
      }
      if (owner?.id !== survivor.id) continue;
      if (distance(pack, survivor) <= p.radius) {
        survivor.health.current = Math.min(survivor.health.max, survivor.health.current + (p.amount ?? survivor.health.max * .5));
        this.collect(pack.id, p);
      } else this.world.npcs!.move(survivor, pack.transform, 3.8, survivor.civilian!, p.radius * .75);
      this.world.spatial.set(survivor.id, survivor.transform.x, survivor.transform.z);
      return true;
    }
    return false;
  }
  private collect(id: number, p: Pickup): void {
    p.collected = true; delete p.reservedFor; this.world.spatial.delete(id);
    this.world.events.emit({ type: 'pickup.collected', tick: this.world.tick, id, kind: p.kind, item: p.item });
  }
  update(): void {
    const player = this.world.entities.get(1)!; if (player.health.current <= 0) return;
    for (const e of this.world.entities.iterate()) {
      const p = e.pickup;
      if (!p || !('kind' in p) || p.collected || (player.transform.x - e.transform.x) ** 2 + (player.transform.z - e.transform.z) ** 2 > p.radius ** 2) continue;
      if (p.kind === 'medkit' || p.kind === 'soda') {
        if (player.health.current >= player.health.max) continue;
        player.health.current = Math.min(player.health.max, player.health.current + (p.amount ?? player.health.max * (p.kind === 'medkit' ? .5 : .15)));
      } else if (p.kind === 'energy-drink') player.speedBuff = { multiplier: 1.25, until: this.world.tick + 480 };
      else if (p.kind === 'item') this.world.interactables!.giveItem(p.item!);
      else {
        const loadout = this.world.combat?.runner.loadout; if (!loadout) continue;
        let refilled = false;
        for (const side of ['LEFT', 'RIGHT'] as const) for (const slot of loadout.state[side].rack) {
          const def = action(slot.id);
          if (def.category === 'throwable' && slot.charges < def.charges) { slot.charges++; if (slot.charges === def.charges) slot.nextCharge = 0; refilled = true; }
        }
        if (!refilled) continue;
      }
      this.collect(e.id, p);
    }
  }
}
