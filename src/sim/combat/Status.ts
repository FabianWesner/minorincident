import { ticks, type StatusDef, type StatusKind } from '../../data/actions/schema';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
export interface StatusState { kind: StatusKind; stacks: number; expires: number; nextDot: number; def: StatusDef; sourceId: number; actionId: string }
export interface WaterZone { x: number; z: number; radius: number }
/** Same-kind applications refresh duration and cap stacks; water removes burning before its DoT. */
export class Status {
  readonly water: WaterZone[] = [];
  constructor(private readonly world: SimWorld) {}
  apply(target: EntitySnapshot, def: StatusDef, sourceId: number, actionId: string): void {
    if (!target.combat || target.health.current <= 0 || (target.infected?.special === 'fire-immune' && def.kind === 'burning') || (target.archetype === 'infected.hazmat' && def.kind === 'toxic')) return;
    const statuses = target.combat.statuses, existing = statuses.find((status) => status.kind === def.kind);
    if (existing) { existing.stacks = Math.min(def.maxStacks, existing.stacks + 1); existing.expires = this.world.tick + ticks(def.duration); }
    else statuses.push({ kind: def.kind, stacks: 1, expires: this.world.tick + ticks(def.duration), nextDot: this.world.tick + 60, def, sourceId, actionId });
    if (def.kind === 'stunned') target.combat.attacking = false;
  }
  update(): void {
    for (const entity of this.world.entities.iterate()) {
      const statuses = entity.combat?.statuses;
      if (!statuses) continue;
      for (let i = statuses.length - 1; i >= 0; i--) {
        const status = statuses[i];
        if (entity.health.current <= 0 || (status.kind === 'burning' && this.water.some((zone) => (entity.transform.x - zone.x) ** 2 + (entity.transform.z - zone.z) ** 2 <= zone.radius ** 2))) { statuses.splice(i, 1); continue; }
        // Include the final second, then remove at expiry; subsecond tails integrate exactly.
        const intervalEnd = Math.min(status.nextDot, status.expires);
        if (this.world.tick >= intervalEnd && status.def.dps > 0) {
          const duration = (intervalEnd - (status.nextDot - 60)) / 60;
          this.world.combat!.damage.apply({ attackId: 0, actionId: status.actionId, sourceId: status.sourceId, targetId: entity.id, origin: entity.transform, direction: { x: 0, z: 0 }, base: status.def.dps * status.stacks * duration, multiplier: 1, type: 'status', knockback: 0, stagger: 0 });
          status.nextDot += 60;
        }
        if (this.world.tick >= status.expires) statuses.splice(i, 1);
      }
    }
  }
  static stunned(entity: EntitySnapshot, tick: number): boolean { return (entity.combat?.staggerUntil ?? 0) > tick || !!entity.combat?.statuses.some((status) => status.kind === 'stunned' && status.expires > tick); }
  static speed(entity: EntitySnapshot): number { let scale = 1; for (const status of entity.combat?.statuses ?? []) if (status.kind === 'slowed' || status.kind === 'toxic') scale = Math.min(scale, 1 - status.def.slow); return scale; }
}
