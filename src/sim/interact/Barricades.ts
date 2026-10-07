import * as RAPIER from '@dimforge/rapier3d-compat';
import { infectedDef } from '../../data/infected';
import type { CoverWall } from '../combat/HitQuery';
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
import type { PushProp } from './PropSystem';

/** World-space authored rail. inward points toward the defended side; IDs remain stable for missions. */
export interface BarricadeSlot {
  id: string; groupId: string; a: { x: number; z: number }; b: { x: number; z: number };
  height: number; depth?: number; boardUp?: boolean; inward?: { x: number; z: number };
  /** Already braced obstacles (e.g. the bridge blockade), rather than a build interaction. */
  initialHp?: number;
}
/** Serialized on the slot entity: checkpoints preserve HP, coverage and participating prop IDs. */
export interface BarricadeState { slot: BarricadeSlot; coverage: number; props: string[]; intact: boolean; hitTick: number; breaks: number }
export type BarricadeEvent = { type: 'barricade.built' | 'barricade.broken' | 'barricade.repaired'; tick: number; id: number; slotId: string; groupId: string };

/** Coverage, brace/board/repair and blocker lifecycle. Uses E11 interactions and E07 damage/navigation. */
export class Barricades {
  private readonly detour: number[] = [];
  private readonly decisions = new Map<number, { until: number; id: number; attack: boolean; goalX: number; goalZ: number }>();
  constructor(private readonly world: SimWorld) {
    world.events.on('interact.completed', e => {
      if (e.type !== 'interact.completed') return;
      const entity = world.entities.get(e.id), b = entity?.barricade;
      if (!entity || !b) return;
      if (b.intact) {
        entity.health.current = Math.min(entity.health.max, entity.health.current + entity.health.max * .25);
        this.emit(entity, 'barricade.repaired');
      } else this.build(entity);
      entity.interactable!.completed = false; entity.interactable!.progress = 0;
    });
    world.events.on('combat.hit', e => {
      if (e.type !== 'combat.hit' || e.amount <= 0) return;
      const entity = world.entities.get(e.targetId);
      if (!entity?.barricade?.intact) return;
      entity.barricade.hitTick = world.tick; this.sound(entity, 'hit');
      if (entity.health.current <= 0) this.break(entity);
    });
    world.events.on('world.blocker.changed', () => this.decisions.clear());
  }
  spawn(slot: BarricadeSlot): number {
    if (this.find(slot.id)) throw new Error(`Duplicate barricade slot: ${slot.id}`);
    if (![slot.a.x, slot.a.z, slot.b.x, slot.b.z, slot.height, slot.depth ?? .7, slot.initialHp ?? 200].every(Number.isFinite)
      || Math.hypot(slot.b.x - slot.a.x, slot.b.z - slot.a.z) < .1 || slot.height <= 0 || (slot.depth ?? .7) <= 0 || (slot.initialHp ?? 200) <= 0) throw new RangeError('Invalid barricade slot');
    const x = (slot.a.x + slot.b.x) / 2, z = (slot.a.z + slot.b.z) / 2;
    const id = this.world.interactables!.spawn('barricade', { x, z }, { radius: 1.6, holdTime: slot.boardUp ? 2 : 1.5, instant: !slot.boardUp, label: slot.boardUp ? 'Board up' : 'Brace' });
    const e = this.world.entities.get(id)!;
    e.health = { current: 0, max: 200 };
    e.barricade = { slot: structuredClone(slot), coverage: 0, props: [], intact: false, hitTick: -60, breaks: 0 };
    e.combat = { radius: Math.hypot(slot.b.x - slot.a.x, slot.b.z - slot.a.z) / 2, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] };
    this.world.spatial.delete(id);
    if (slot.initialHp) this.build(e, slot.initialHp);
    return id;
  }
  private find(slotId: string): EntitySnapshot | undefined { return this.world.entities.values().find(e => e.barricade?.slot.id === slotId); }
  /** Mission predicate: unknown/unbuilt/broken slots return false. */
  barricadeIntact(slotId: string): boolean { return this.find(slotId)?.barricade?.intact === true; }
  /** Empty or unknown groups return false; every authored slot must be intact. */
  allBarricaded(groupId: string): boolean {
    const group = this.world.entities.values().filter(e => e.barricade?.slot.groupId === groupId);
    return group.length > 0 && group.every(e => e.barricade!.intact);
  }
  private wall(e: EntitySnapshot): CoverWall {
    const s = e.barricade!.slot, depth = s.depth ?? .7;
    return { x: e.transform.x, z: e.transform.z, y: s.height / 2, halfY: s.height / 2,
      halfX: Math.max(.15, Math.abs(s.b.x - s.a.x) / 2 + depth / 2), halfZ: Math.max(.15, Math.abs(s.b.z - s.a.z) / 2 + depth / 2), entityId: e.id };
  }
  private candidates(e: EntitySnapshot): { items: PushProp[]; coverage: number } {
    const s = e.barricade!.slot, dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, width = Math.hypot(dx, dz), nx = dx / width, nz = dz / width;
    const intervals: [number, number][] = [], items: PushProp[] = [];
    for (const p of this.world.props?.items ?? []) {
      if (p.fixed || p.braced || !p.body.isEnabled()) continue;
      const x = p.pose.p[0] - s.a.x, z = p.pose.p[2] - s.a.z;
      if (Math.abs(x * -nz + z * nx) > (s.depth ?? .7) / 2 + Math.min(p.half[0], p.half[2])) continue;
      const yaw = 2 * Math.atan2(p.pose.q[1], p.pose.q[3]);
      const half = (Math.abs(nx * Math.cos(yaw) - nz * Math.sin(yaw)) * p.half[0] + Math.abs(nx * Math.sin(yaw) + nz * Math.cos(yaw)) * p.half[2]) * (p.metadata.barricadeValue ?? 1);
      const center = x * nx + z * nz, a = Math.max(0, center - half), b = Math.min(width, center + half);
      if (a < b && p.half[1] * 2 >= s.height * .8) { intervals.push([a, b]); items.push(p); }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let covered = 0, end = 0;
    for (const [a, b] of intervals) { covered += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    return { items, coverage: Math.min(1, covered / width) };
  }
  /** E11 prompt update before stand-to-interact selects a slot. Movement interrupts board/repair. */
  update(): void {
    for (const e of this.world.entities.iterate()) {
      const b = e.barricade, c = e.interactable; if (!b || !c) continue;
      if (b.intact && e.health.current <= 0) this.break(e);
      const candidates = b.intact ? null : this.candidates(e);
      b.coverage = b.intact || b.slot.boardUp ? 1 : candidates!.coverage;
      c.label = b.intact ? 'Repair' : b.slot.boardUp ? 'Board up' : 'Brace';
      c.holdTime = b.intact || b.slot.boardUp ? 2 : 1.5;
      c.instant = !b.intact && !b.slot.boardUp;
      c.enabled = b.intact ? e.health.current < e.health.max && !b.slot.initialHp : b.slot.boardUp === true || b.coverage >= .8;
      if (!c.enabled) c.progress = 0;
    }
  }
  private build(e: EntitySnapshot, initialHp?: number): void {
    const b = e.barricade!, result = this.candidates(e);
    if (!initialHp && !b.slot.boardUp && result.coverage < .8) return;
    const items = b.slot.boardUp || initialHp ? [] : result.items;
    b.props = items.map(p => p.id); b.intact = true; b.coverage = 1; e.kind = 'barricade';
    const hp = initialHp ?? (b.slot.boardUp ? 200 : items.reduce((sum, p) => sum + (p.metadata.barricadeHP ?? 80), 0));
    e.health = { current: hp, max: hp };
    Object.assign(e.interactable!, { label: 'Repair', holdTime: 2, instant: false, enabled: false });
    for (const p of items) this.world.props!.brace(p, true);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    this.world.interactables!.block(e.id, this.wall(e)); this.sound(e, 'brace'); this.emit(e, 'barricade.built');
  }
  private break(e: EntitySnapshot): void {
    const b = e.barricade!; if (!b.intact) return;
    b.intact = false; b.breaks++; e.kind = 'device'; e.health.current = 0;
    this.world.interactables!.unblock(e.id); this.world.spatial.delete(e.id);
    for (const id of b.props) { const p = this.world.props?.items.find(p => p.id === id); if (p) this.world.props!.brace(p, false, b.slot.inward); }
    b.props = []; this.sound(e, 'break'); this.emit(e, 'barricade.broken');
    this.world.events.emit({ type: 'vfx.effect', tick: this.world.tick, kind: 'objective', position: e.transform, radius: 1 });
  }
  private emit(e: EntitySnapshot, type: BarricadeEvent['type']): void { const s = e.barricade!.slot; this.world.events.emit({ type, tick: this.world.tick, id: e.id, slotId: s.id, groupId: s.groupId }); }
  private sound(e: EntitySnapshot, phase: 'brace' | 'hit' | 'break'): void { this.world.events.emit({ type: 'barricade.sound', tick: this.world.tick, sourceId: e.id, position: e.transform, phase, hp: e.health.current, maxHp: e.health.max }); }
  /** Restore after entity/prop checkpoint load or a physics world rebuild. */
  rebuild(): void {
    for (const p of this.world.props?.items ?? []) if (p.braced) { p.braced = false; p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, false); p.body.sleep(); }
    for (const e of this.world.entities.iterate()) if (e.barricade) {
      if (e.barricade.intact) {
        for (const id of e.barricade.props) { const p = this.world.props?.items.find(p => p.id === id); if (p) this.world.props!.brace(p, true); }
        this.world.interactables!.block(e.id, this.wall(e));
      } else this.world.interactables!.unblock(e.id);
    }
    this.decisions.clear();
  }
  /** Select an obstructing brace. Budgeted and cached: detours <=1.5x are preferred. */
  attackTarget(attacker: EntitySnapshot, goal: { x: number; z: number }): EntitySnapshot | undefined {
    for (const e of this.world.entities.iterate()) {
      if (!e.barricade?.intact) continue;
      const wall = this.wall(e), distance = Math.hypot(Math.max(0, Math.abs(attacker.transform.x - wall.x) - wall.halfX), Math.max(0, Math.abs(attacker.transform.z - wall.z) - wall.halfZ));
      if (distance > 1.5) continue;
      const dx = goal.x - attacker.transform.x, dz = goal.z - attacker.transform.z, length = Math.hypot(dx, dz);
      const projection = ((wall.x - attacker.transform.x) * dx + (wall.z - attacker.transform.z) * dz) / Math.max(.01, length * length);
      const cross = Math.abs((wall.x - attacker.transform.x) * dz - (wall.z - attacker.transform.z) * dx) / Math.max(.01, length);
      if (projection <= 0 || projection >= 1 || cross > Math.hypot(wall.halfX, wall.halfZ)) continue;
      const cache = this.decisions.get(attacker.id);
      if (cache && cache.id === e.id && cache.until > this.world.tick && Math.hypot(cache.goalX - goal.x, cache.goalZ - goal.z) < 1) { if (cache.attack) return e; continue; }
      const nav = this.world.infected!.navigation.grid(attacker.transform);
      const found = nav.path(nav.nearestCell(attacker.transform.x, attacker.transform.z), nav.nearestCell(goal.x, goal.z), this.detour, 300);
      const attack = !found || this.detour.length * nav.cellSize > length * 1.5;
      this.decisions.set(attacker.id, { id: e.id, until: this.world.tick + 60, attack, goalX: goal.x, goalZ: goal.z });
      if (attack) return e;
    }
  }
  /** Defined E07 attack cadence: one hit after windup followed by a one-second cooldown. */
  dps(archetype: string): number { const d = infectedDef(archetype); return d.damage * (archetype === 'infected.brute' ? 5 : archetype === 'infected.butcher' ? 8 : 1) / (d.windup + 1); }
}
