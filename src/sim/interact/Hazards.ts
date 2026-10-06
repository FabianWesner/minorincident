// Adapted from Bruno Simon folio-2025 World/ExplosiveCrates.js (MIT, 41046b5):
// arm once, delay the blast, disable. Fixed tick timers replace GSAP/wall time.
import { DebrisPool } from '../../physics/DebrisPool';
import { Damage } from '../combat/Damage';
import type { DamageEvent } from '../combat/Damage';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { Vec2 } from '../../input/InputFrame';
export const hazardKinds = ['propane', 'barrel', 'gas-can', 'car-alarm', 'fuse-box', 'fire', 'toxic', 'water', 'metal-fence', 'live-wire', 'fuel-trail'] as const;
export const destructibleKinds = ['fence', 'crate', 'barricade', 'cone', 'trash-can', 'mailbox', 'glass'] as const;
export type HazardKind = typeof hazardKinds[number];
export type DestructibleKind = typeof destructibleKinds[number];
const harmfulKinds: readonly HazardKind[] = ['fire', 'toxic', 'water', 'metal-fence', 'live-wire'];
export interface Hazard { kind: HazardKind; radius: number; fuseAt: number; exploded: boolean; activeUntil: number; leaked: boolean }
export interface Destructible { kind: DestructibleKind | 'fuel-trail'; flammable: boolean; exposure: number; burnTime: number; burningUntil: number; broken: boolean }
export interface HazardOptions { hp?: number; radius?: number; burnTime?: number; halfX?: number; halfZ?: number; duration?: number }
/** E11 hazard triggers/damage; E27 consumes arming/blast events for richer effects. */
export class Hazards {
  readonly debris: DebrisPool;
  private readonly damage: Damage;
  private readonly neighbors: number[] = [];
  private readonly area = { x: 0, z: 0, r: 0 };
  private readonly blastTicks = new Int32Array(8).fill(-60);
  private blastCursor = 0;
  constructor(private readonly world: SimWorld) {
    this.debris = new DebrisPool(world.physics); this.damage = world.combat?.damage ?? new Damage(world);
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || e.amount <= 0) return;
      const entity = world.entities.get(e.targetId); if (!entity) return;
      const h = entity.hazard;
      if (h?.kind === 'car-alarm') this.alarm(entity);
      if (h?.kind === 'fuse-box' && e.damageType === 'bullet') this.electrify(entity);
      if (h?.kind === 'gas-can' && e.damageType === 'bullet' && !h.leaked) {
        h.leaked = true;
        for (let i = 0; i < 4; i++) this.spawn('fuel-trail', { x: entity.transform.x + i * .75, z: entity.transform.z });
        world.events.emit({ type: 'hazard.leaked', tick: world.tick, id: entity.id });
      }
      if (entity.health.current <= 0) this.destroy(entity);
    });
  }
  spawn(kind: HazardKind | DestructibleKind, pos: Vec2, opts: HazardOptions = {}): number {
    if (![...hazardKinds, ...destructibleKinds].includes(kind) || ![pos.x, pos.z, opts.hp ?? 1, opts.radius ?? 1, opts.burnTime ?? 1, opts.halfX ?? .5, opts.halfZ ?? .15, opts.duration ?? 1].every(Number.isFinite)
      || [opts.hp ?? 1, opts.radius ?? 1, opts.burnTime ?? 1, opts.halfX ?? .5, opts.halfZ ?? .15, opts.duration ?? 1].some(n => n <= 0)) throw new RangeError('Invalid hazard');
    const isProp = (destructibleKinds as readonly string[]).includes(kind), hp = opts.hp ?? (kind === 'propane' || kind === 'barrel' ? 20 : kind === 'car-alarm' ? 1000 : 60);
    const e = this.world.entities.create({ kind: isProp ? 'prop' : 'hazard', archetype: `${isProp ? 'prop' : 'hazard'}.${kind}`, faction: 'environment', health: { current: hp, max: hp }, transform: { ...pos, y: .7, yaw: 0 } });
    if (!isProp) e.hazard = { kind: kind as HazardKind, radius: opts.radius ?? (kind === 'propane' || kind === 'barrel' ? 5 : kind === 'car-alarm' ? 20 : 2), fuseAt: 0, exploded: false, activeUntil: kind === 'fire' || kind === 'toxic' || kind === 'live-wire' ? this.world.tick + Math.ceil((opts.duration ?? 30) * 60) : 0, leaked: false };
    if (isProp || kind === 'fuel-trail') e.destructible = { kind: kind as DestructibleKind | 'fuel-trail', flammable: ['fence', 'crate', 'barricade', 'fuel-trail'].includes(kind), exposure: 0, burnTime: opts.burnTime ?? 6, burningUntil: 0, broken: false };
    const zone = ['fire', 'toxic', 'water', 'live-wire', 'fuel-trail'].includes(kind);
    if (!zone) {
      e.combat = { radius: Math.max(opts.halfX ?? .5, opts.halfZ ?? .15) + .1, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] };
      this.world.interactables!.block(e.id, { ...pos, y: .7, halfX: opts.halfX ?? .5, halfY: .7, halfZ: opts.halfZ ?? .15, entityId: e.id });
    }
    this.world.spatial.set(e.id, pos.x, pos.z); return e.id;
  }
  /** Damage entry point for non-weapon triggers; weapons use Damage.apply and the same hit event. */
  hit(id: number, amount: number, type: DamageEvent['type']): number {
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Invalid hazard damage');
    return this.damage.apply({ attackId: 0, actionId: 'hazard.trigger', sourceId: 1, targetId: id, origin: this.world.entities.get(1)!.transform, direction: { x: 0, z: 0 }, base: amount, multiplier: 1, type, knockback: 0, stagger: 0 });
  }
  private destroy(e: EntitySnapshot): void {
    const h = e.hazard;
    if (h && ['propane', 'barrel'].includes(h.kind)) {
      if (!h.fuseAt && !h.exploded) { h.fuseAt = this.world.tick + 18; this.world.events.emit({ type: 'hazard.armed', tick: this.world.tick, id: e.id, fuseAt: h.fuseAt }); }
      return;
    }
    if (e.destructible && !e.destructible.broken) {
      e.destructible.broken = true; this.world.interactables!.unblock(e.id); this.world.spatial.delete(e.id);
      const pieces = e.destructible.kind === 'fuel-trail' ? 0 : this.debris.spawn(e.id, e.transform, this.world.tick);
      this.world.events.emit({ type: 'prop.broken', tick: this.world.tick, id: e.id, pieces });
    }
  }
  private nearby(e: EntitySnapshot, radius: number): readonly number[] {
    this.area.x = e.transform.x; this.area.z = e.transform.z; this.area.r = radius;
    return this.world.spatial.query(this.area, this.neighbors);
  }
  private alarm(e: EntitySnapshot): void {
    e.hazard!.activeUntil = this.world.tick + 600;
    this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId: e.id, actionId: 'hazard.car-alarm', position: { x: e.transform.x, y: e.transform.y, z: e.transform.z }, radius: 20, loudness: 1, kind: 'alarm', duration: 10 });
    this.lure(e);
  }
  private lure(e: EntitySnapshot): void {
    for (const id of this.nearby(e, 20)) {
      const target = this.world.entities.get(id)!;
      if (target.faction === 'infected' && target.health.current > 0) {
        target.noiseTarget ??= { id: e.id, until: e.hazard!.activeUntil };
        target.noiseTarget.id = e.id; target.noiseTarget.until = e.hazard!.activeUntil;
        if (target.hearing) {
          target.hearing.mode = 'lured'; target.hearing.target.x = e.transform.x; target.hearing.target.z = e.transform.z;
          target.hearing.lureUntil = e.hazard!.activeUntil;
        }
      }
    }
  }
  private electrify(e: EntitySnapshot): void {
    for (const id of this.nearby(e, 5)) {
      const h = this.world.entities.get(id)!.hazard;
      if (h && ['water', 'metal-fence'].includes(h.kind)) { h.activeUntil = this.world.tick + 300; this.world.events.emit({ type: 'hazard.electrified', tick: this.world.tick, id, until: h.activeUntil }); }
    }
  }
  private explode(e: EntitySnapshot): void {
    // 07 §4: cap chain work to eight blasts per rolling sim second.
    if (this.world.tick - this.blastTicks[this.blastCursor] < 60) return;
    this.blastTicks[this.blastCursor] = this.world.tick; this.blastCursor = (this.blastCursor + 1) % 8;
    const h = e.hazard!; h.exploded = true; this.world.interactables!.unblock(e.id);
    this.world.events.emit({ type: 'hazard.exploded', tick: this.world.tick, id: e.id, position: { x: e.transform.x, y: .7, z: e.transform.z }, radius: h.radius });
    // Copy the query IDs once per blast: hit events may query neighbors recursively (alarm/fuse).
    for (const id of [...this.nearby(e, h.radius)]) {
      const target = this.world.entities.get(id)!;
      const distance = Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z);
      this.damage.apply({ attackId: 0, actionId: 'hazard.propane', sourceId: e.id, targetId: id, origin: e.transform, direction: { x: 0, z: 0 }, base: 100 * Math.max(0, h.radius - distance) / h.radius, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
    }
  }
  snapshot() { return { blastTicks: [...this.blastTicks], blastCursor: this.blastCursor }; }
  update(): void {
    const tick = this.world.tick;
    const actionZones = this.world.combat?.effects.zones;
    let fireReach = 2;
    for (const e of this.world.entities.iterate()) if (e.hazard?.kind === 'fire' && tick < e.hazard.activeUntil) fireReach = Math.max(fireReach, e.hazard.radius);
    for (const e of this.world.entities.iterate()) {
      if (e.noiseTarget && tick >= e.noiseTarget.until) delete e.noiseTarget;
      const h = e.hazard, d = e.destructible;
      if (h?.fuseAt && tick >= h.fuseAt && !h.exploded) this.explode(e);
      if (h?.kind === 'car-alarm' && tick < h.activeUntil) this.lure(e);
      if (d?.flammable && !d.broken) {
        if (d.burningUntil && tick >= d.burningUntil) { e.health.current = 0; this.destroy(e); }
        else if (!d.burningUntil) {
          let exposed = false;
          if (actionZones) for (const zone of actionZones) {
            if (zone.kind === 'fire' && tick < zone.expires && (zone.x - e.transform.x) ** 2 + (zone.z - e.transform.z) ** 2 <= zone.radius ** 2) { exposed = true; break; }
          }
          for (const id of this.nearby(e, fireReach)) {
            const source = this.world.entities.get(id)!;
            const distance = (source.transform.x - e.transform.x) ** 2 + (source.transform.z - e.transform.z) ** 2;
            if (source.id !== e.id && ((source.hazard?.kind === 'fire' && tick < source.hazard.activeUntil && distance <= source.hazard.radius ** 2) || (source.destructible && !source.destructible.broken && source.destructible.burningUntil > tick && distance <= 4))) { exposed = true; break; }
          }
          d.exposure = exposed ? d.exposure + 1 : 0;
          if (d.exposure >= 120) { d.burningUntil = tick + Math.ceil(d.burnTime * 60); this.world.events.emit({ type: 'prop.ignited', tick, id: e.id, until: d.burningUntil }); }
        }
      }
      const burns = d && !d.broken && d.burningUntil > tick;
      const harms = h && tick < h.activeUntil && harmfulKinds.includes(h.kind);
      if (tick % 60 === 0 && (burns || harms)) {
        for (const id of this.nearby(e, h?.radius ?? 1)) {
          const target = this.world.entities.get(id)!;
          if (target.faction === 'environment' || target.health.current <= 0 || (h?.kind === 'toxic' && target.archetype === 'infected.hazmat') || (h?.kind === 'fire' && target.archetype === 'infected.firefighter')) continue;
          this.damage.apply({ attackId: 0, actionId: `hazard.${h?.kind ?? 'fire'}`, sourceId: e.id, targetId: id, origin: e.transform, direction: { x: 0, z: 0 }, base: 10, multiplier: 1, type: 'status', knockback: 0, stagger: 0 });
        }
      }
    }
    this.debris.update(tick);
  }
}
