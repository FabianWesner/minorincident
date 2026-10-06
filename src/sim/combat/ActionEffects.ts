import { noiseForAction } from '../../data/noise';
import { action } from '../../data/actions/catalog';
import { ticks, type ActionEffect } from '../../data/actions/schema';
import type { Attack } from './ActionRunner';
import type { Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';
import { Status } from './Status';
/** Arming → persistent effect → expiry follows Bruno's ExplosiveCrates (MIT), on sim time.
 * E07 consumes noise/targets; E27 can replace presentation without changing these definitions. */
export interface ActionZone extends ActionEffect { x: number; z: number; created: number; expires: number; nextPulse: number; attack: Attack }
export class ActionEffects {
  readonly zones: ActionZone[] = [];
  private readonly direction = { x: 0, z: 0 };
  constructor(private readonly world: SimWorld) {}
  noise(position: Vec2, radius: number, actionId: string, sourceId = 1, kind?: string): void {
    if (!radius) return;
    this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId, actionId, position: { x: position.x, y: 0.7, z: position.z }, radius, loudness: kind ? 1 : noiseForAction(actionId).loudness, kind: kind ?? action(actionId).category });
    for (const entity of this.world.entities.iterate()) {
      const brain = entity.hearing;
      if (!brain || entity.health.current <= 0 || brain.mode === 'lured' || this.inSmoke(entity.transform) || (entity.transform.x - position.x) ** 2 + (entity.transform.z - position.z) ** 2 > radius ** 2) continue;
      if (brain.mode === 'idle') this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, targetId: entity.id, sourceId, cause: 'noise', position: { ...entity.transform } });
      brain.mode = 'investigate'; brain.target.x = position.x; brain.target.z = position.z;
    }
  }
  create(attack: Attack, position: Vec2): void {
    const effect = attack.def.effect; if (!effect) return;
    const zone: ActionZone = { ...effect, x: position.x, z: position.z, created: this.world.tick, expires: this.world.tick + ticks(effect.duration), nextPulse: this.world.tick, attack };
    this.zones.push(zone);
    this.world.events.emit({ type: 'combat.effect', tick: this.world.tick, sourceId: attack.sourceId, actionId: attack.def.id, kind: effect.kind, position: { x: zone.x, y: 0, z: zone.z }, radius: zone.radius, expires: zone.expires });
    if (effect.kind === 'lure') this.noise(position, effect.radius, attack.def.id);
  }
  private contains(zone: ActionZone, position: Vec2): boolean { return (position.x - zone.x) ** 2 + (position.z - zone.z) ** 2 <= zone.radius ** 2; }
  inSmoke(position: Vec2): boolean { return this.zones.some((z) => z.kind === 'smoke' && this.contains(z, position) && z.expires > this.world.tick); }
  shielded(position: Vec2): boolean { return this.zones.some((z) => z.kind === 'shield' && this.contains(z, position) && z.expires > this.world.tick); }
  get speedMultiplier(): number { return this.zones.some((z) => z.kind === 'adrenaline' && z.expires > this.world.tick) ? 1.5 : 1; }
  /** Reuses zone/entity buffers. Persistent DoT refreshes once per second, never per render frame. */
  update(): void {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i];
      if (this.world.tick >= zone.expires) { this.zones.splice(i, 1); continue; }
      if (zone.kind === 'shield' || zone.kind === 'adrenaline') { const player = this.world.entities.get(zone.attack.sourceId)!; zone.x = player.transform.x; zone.z = player.transform.z; }
      if (zone.kind === 'lure') {
        for (const entity of this.world.entities.iterate()) if (entity.hearing && entity.health.current > 0 && this.contains(zone, entity.transform) && entity.hearing.lureUntil <= zone.expires) {
          entity.hearing.mode = 'lured'; entity.hearing.target.x = zone.x; entity.hearing.target.z = zone.z; entity.hearing.lureUntil = zone.expires;
        }
      } else if (zone.kind === 'fire') {
        const pulse = this.world.tick >= zone.nextPulse;
        for (const entity of this.world.entities.iterate()) if (entity.faction === 'infected' && entity.health.current > 0 && this.contains(zone, entity.transform) && zone.attack.def.status && (pulse || !entity.combat?.statuses.some((s) => s.kind === 'burning'))) this.world.combat!.status.apply(entity, zone.attack.def.status, zone.attack.sourceId, zone.attack.def.id);
        if (pulse) zone.nextPulse += 60;
      } else if (zone.kind === 'turret' && this.world.tick >= zone.nextPulse) {
        const combat = this.world.combat!;
        let target: import('../world/types').EntitySnapshot | undefined, nearest = zone.radius;
        for (const entity of this.world.entities.iterate()) {
          const distance = Math.hypot(entity.transform.x - zone.x, entity.transform.z - zone.z);
          if (entity.faction === 'infected' && entity.health.current > 0 && distance < nearest && combat.query.visible(zone, entity.transform)) { target = entity; nearest = distance; }
        }
        if (target) { this.direction.x = (target.transform.x - zone.x) / (nearest || 1); this.direction.z = (target.transform.z - zone.z) / (nearest || 1);
          combat.damage.apply({ attackId: zone.attack.id, actionId: zone.attack.def.id, sourceId: zone.attack.sourceId, targetId: target.id, origin: zone, direction: this.direction, base: zone.attack.def.damage, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 });
          this.noise(zone, zone.attack.def.noiseRadius, zone.attack.def.id);
        }
        zone.nextPulse += ticks(1 / zone.attack.def.fireRate);
      }
    }
  }
  /** Minimal hearing response for reactive arena fixtures, not E07 archetype AI.
   * Uses two tangent waypoints plus boundary steering to prefer going around fire. */
  moveListeners(): void {
    for (const entity of this.world.entities.iterate()) {
      const brain = entity.hearing;
      if (!brain || entity.health.current <= 0 || entity.attachedTo) continue;
      if (brain.mode === 'lured' && this.world.tick >= brain.lureUntil) brain.mode = 'idle';
      if (this.inSmoke(entity.transform)) brain.mode = 'idle';
      if (brain.mode === 'idle' || Status.stunned(entity, this.world.tick)) continue;
      let dx = brain.target.x - entity.transform.x, dz = brain.target.z - entity.transform.z, distance = Math.hypot(dx, dz);
      if (distance < 0.1) { if (brain.mode !== 'lured') brain.mode = 'idle'; continue; }
      for (const zone of this.zones) {
        if (zone.kind !== 'fire' || zone.expires <= this.world.tick || this.contains(zone, brain.target)) continue;
        const px = entity.transform.x - zone.x, pz = entity.transform.z - zone.z, radial = Math.hypot(px, pz), radius = zone.radius + 0.5;
        const along = -(px * dx + pz * dz) / distance, cross = (px * dz - pz * dx) / distance;
        if (radial > zone.radius && along > 0 && along < distance && Math.abs(cross) < radius) {
          const sign = cross === 0 ? (entity.id % 2 ? 1 : -1) : Math.sign(cross);
          const tangentAngle = Math.atan2(pz, px) + sign * Math.acos(Math.min(1, radius / radial));
          dx = zone.x + Math.cos(tangentAngle) * radius - entity.transform.x; dz = zone.z + Math.sin(tangentAngle) * radius - entity.transform.z;
          // Already at tangent: follow the safe circle until the direct route opens.
          if (Math.hypot(dx, dz) < 0.15) { dx = -pz * sign; dz = px * sign; }
          distance = Math.hypot(dx, dz);
        }
      }
      this.direction.x = dx / distance; this.direction.z = dz / distance;
      const move = Math.min(distance, 2.4 / 60 * Status.speed(entity)), clear = this.world.combat!.query.clearDistance(entity.transform, this.direction, move + 0.4);
      const step = Math.max(0, Math.min(move, clear - 0.4));
      entity.transform.x += this.direction.x * step; entity.transform.z += this.direction.z * step;
      entity.transform.yaw = -Math.atan2(this.direction.z, this.direction.x);
      this.world.spatial.set(entity.id, entity.transform.x, entity.transform.z);
    }
  }
  snapshot() { return this.zones.map(({ attack, ...zone }) => ({ ...zone, attackId: attack.id, actionId: attack.def.id, sourceId: attack.sourceId })); }
}
