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
  /** Low sandbag cover permits runners to cross in 72 ticks. */
  sandbag?: boolean;
  /** Army/destructible cover can break without exposing a player rebuild interaction. */
  playerBuildable?: boolean;
}
/** Serialized on the slot entity: checkpoints preserve HP, coverage and participating prop IDs. */
export interface BarricadeState { slot: BarricadeSlot; coverage: number; props: string[]; carId?: number; intact: boolean; hitTick: number; breaks: number }
export type BarricadeEvent = { type: 'barricade.damaged'; tick: number; id: number; sourceId: number; attackId: number; slotId: string; groupId: string; previousHp: number; hp: number; amount: number; props: string[] } | { type: 'barricade.built' | 'barricade.broken' | 'barricade.repaired'; tick: number; id: number; slotId: string; groupId: string };

/** Coverage, brace/board/repair and blocker lifecycle. Uses E11 interactions and E07 damage/navigation. */
export class Barricades {
  private readonly detour: number[] = [];
  private readonly obstacles: [EntitySnapshot, CoverWall, number][] = [];
  private obstacleTick = -1;
  private readonly decisions = new Map<number, { until: number; id: number; attack: boolean; goalX: number; goalZ: number }>();
  constructor(private readonly world: SimWorld) {
    world.events.on('interact.completed', e => {
      if (e.type !== 'interact.completed') return;
      const entity = world.entities.get(e.id), b = entity?.barricade;
      if (!entity || !b || !this.playerBuildable(entity)) return;
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
      const slot = entity.barricade.slot;
      world.events.emit({ type: 'barricade.damaged', tick: world.tick, id: entity.id, sourceId: e.sourceId, attackId: e.attackId, slotId: slot.id, groupId: slot.groupId, previousHp: entity.health.current + e.amount, hp: entity.health.current, amount: e.amount, props: [...entity.barricade.props] });
      if (entity.health.current <= 0) this.break(entity);
    });
    world.events.on('world.blocker.changed', () => { this.decisions.clear(); this.obstacleTick = -1; });
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
  /** Campaign rebuilds belong to the missions that use them; sandbox E26 fixtures remain buildable. */
  playerBuildable(entity: EntitySnapshot): boolean {
    return !!entity.barricade && entity.barricade.slot.playerBuildable !== false &&
      (!/^L\d+$/.test(this.world.scenario ?? '') || this.world.missions?.def.l2 === true || this.world.missions?.def.l6 === true);
  }
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
      if (a < b && p.half[1] * 2 >= s.height * (e.archetype==='l6.service-gate'?.25:.8)) { intervals.push([a, b]); items.push(p); }
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let covered = 0, end = 0;
    for (const [a, b] of intervals) { covered += Math.max(0, b - Math.max(a, end)); end = Math.max(end, b); }
    return { items, coverage: Math.min(1, covered / width) };
  }
  private car(e: EntitySnapshot) {
    const s = e.barricade!.slot, dx = s.b.x - s.a.x, dz = s.b.z - s.a.z, width = Math.hypot(dx, dz);
    for (const car of this.world.vehicles?.cars.values() ?? []) {
      const t = car.entity.transform, v = car.entity.vehicle!;
      if (v.driver !== null || v.braced || car.entity.health.current <= 0 || car.physics.speed >= .5) continue;
      if (Math.abs((t.x - s.a.x) * -dz / width + (t.z - s.a.z) * dx / width) > (s.depth ?? .7) / 2 + car.physics.def.width / 2) continue;
      const half = (Math.abs(dx / width * Math.cos(t.yaw) - dz / width * Math.sin(t.yaw)) * car.physics.def.length + Math.abs(dx / width * Math.sin(t.yaw) + dz / width * Math.cos(t.yaw)) * car.physics.def.width) / 2;
      const center = ((t.x - s.a.x) * dx + (t.z - s.a.z) * dz) / width;
      if (center - half <= 0 && center + half >= width) return car;
    }
  }
  /** E11 prompt update before stand-to-interact selects a slot. Movement interrupts board/repair. */
  update(): void {
    for (const e of this.world.entities.iterate()) {
      const b = e.barricade, c = e.interactable; if (!b || !c) continue;
      if (b.intact && e.health.current <= 0) this.break(e);
      if (!this.playerBuildable(e)) { c.enabled = false; c.progress = 0; b.coverage = b.intact ? 1 : 0; continue; }
      const candidates = b.intact ? null : this.candidates(e);
      b.coverage = b.intact || b.slot.boardUp || this.car(e) ? 1 : candidates!.coverage;
      c.label = b.intact ? 'Repair' : b.slot.boardUp ? 'Board up' : 'Brace';
      c.holdTime = b.intact || b.slot.boardUp ? 2 : 1.5;
      c.instant = !b.intact && !b.slot.boardUp;
      c.enabled = b.intact ? e.health.current < e.health.max && !b.slot.initialHp : b.slot.boardUp === true || b.coverage >= .8;
      if (!c.enabled) c.progress = 0;
    }
  }
  /** E24 service leaf uses the same HP, blocker, attack and checkpoint lifecycle as a brace. */
  closeServiceGate(id: number, hp: number): void {
    const e=this.world.entities.get(id); if (!e?.barricade || e.barricade.intact) return;
    e.barricade.slot.initialHp=hp; this.build(e,hp);
  }
  /** Props pushed against a closed metro leaf add their normal E26 HP once. */
  braceServiceGate(id: number): void {
    const e=this.world.entities.get(id), b=e?.barricade;
    if(!e || !b?.intact || e.archetype!=='l6.service-gate')return;
    const items=this.candidates(e).items;
    for(const p of items){b.props.push(p.id);const hp=p.metadata.barricadeHP??80;e.health.max+=hp;e.health.current+=hp;this.world.props!.brace(p,true);}
    if(items.length)this.sound(e,'brace');
  }
  private build(e: EntitySnapshot, initialHp?: number): void {
    const b = e.barricade!, result = this.candidates(e), car = this.car(e);
    if (!initialHp && !b.slot.boardUp && !car && result.coverage < .8) return;
    const items = b.slot.boardUp || initialHp || car ? [] : result.items;
    b.props = items.map(p => p.id); b.intact = true; b.coverage = 1; e.kind = 'barricade';
    const hp = initialHp ?? (car ? car.entity.health.current * 2 : b.slot.boardUp ? 200 : items.reduce((sum, p) => sum + (p.metadata.barricadeHP ?? 80), 0));
    e.health = { current: hp, max: hp };
    Object.assign(e.interactable!, { label: 'Repair', holdTime: 2, instant: false, enabled: false });
    if (car) { b.carId = car.entity.id; car.entity.vehicle!.braced = true; car.physics.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false); }
    for (const p of items) this.world.props!.brace(p, true);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    this.world.interactables!.block(e.id, this.wall(e)); this.sound(e, 'brace'); this.emit(e, 'barricade.built');
  }
  private break(e: EntitySnapshot): void {
    const b = e.barricade!; if (!b.intact) return;
    b.intact = false; b.breaks++; e.kind = 'device'; e.health.current = 0;
    this.world.interactables!.unblock(e.id); this.world.spatial.delete(e.id);
    for (const id of b.props) { const p = this.world.props?.items.find(p => p.id === id); if (p) this.world.props!.brace(p, false, b.slot.inward); }
    if (b.carId !== undefined) {
      const car = this.world.vehicles?.cars.get(b.carId);
      if (car) { car.entity.vehicle!.braced = false; car.physics.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true); const inward = b.slot.inward ?? { x: 0, z: 1 }; car.physics.body.applyImpulse({ x: inward.x * car.physics.def.mass * 2, y: car.physics.def.mass, z: inward.z * car.physics.def.mass * 2 }, true); }
      delete b.carId;
    }
    b.props = []; this.sound(e, 'break'); this.emit(e, 'barricade.broken');
    this.world.events.emit({ type: 'vfx.effect', tick: this.world.tick, kind: 'objective', position: e.transform, radius: 1 });
  }
  private emit(e: EntitySnapshot, type: 'barricade.built' | 'barricade.broken' | 'barricade.repaired'): void { const s = e.barricade!.slot; this.world.events.emit({ type, tick: this.world.tick, id: e.id, slotId: s.id, groupId: s.groupId }); }
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
    for (const car of this.world.vehicles?.cars.values() ?? []) {
      const intact = this.world.entities.values().some(e => e.barricade?.intact && e.barricade.carId === car.entity.id);
      car.entity.vehicle!.braced = intact;
      car.physics.body.setBodyType(intact ? RAPIER.RigidBodyType.KinematicPositionBased : RAPIER.RigidBodyType.Dynamic, false);
    }
    this.decisions.clear();
  }
  /** Select an obstructing brace. Budgeted and cached: detours <=1.5x are preferred. */
  attackTarget(attacker: EntitySnapshot, goal: { x: number; z: number }): EntitySnapshot | undefined {
    if (this.obstacleTick !== this.world.tick) {
      this.obstacleTick = this.world.tick; this.obstacles.length = 0;
      for (const e of this.world.entities.iterate()) if (e.barricade?.intact) {
        const wall = this.wall(e); this.obstacles.push([e, wall, Math.hypot(wall.halfX, wall.halfZ)]);
      }
      for (const [id, wall] of this.world.props?.navWalls ?? []) { const e = this.world.entities.get(id); if (e && e.health.current > 0) this.obstacles.push([e, wall, Math.hypot(wall.halfX, wall.halfZ)]); }
    }
    if (!this.obstacles.length) return;
    // The attack segment is constant across this scan, and wall radii are
    // constant for the tick's obstacle list. Dense hordes used to recompute
    // both hypotenuses for every attacker/obstacle pair.
    const ax = attacker.transform.x, az = attacker.transform.z;
    const dx = goal.x - ax, dz = goal.z - az, length = Math.hypot(dx, dz);
    const along = Math.max(.01, length * length), across = Math.max(.01, length);
    for (const [e, wall, radius] of this.obstacles) {
      const wx = wall.x - ax, wz = wall.z - az;
      const projection = (wx * dx + wz * dz) / along;
      if (projection <= 0 || projection >= 1) continue;
      const cross = Math.abs(wx * dz - wz * dx) / across;
      if (cross > radius) continue;
      const cache = this.decisions.get(attacker.id);
      if (cache && cache.id === e.id && cache.until > this.world.tick && Math.hypot(cache.goalX - goal.x, cache.goalZ - goal.z) < 1) { if (cache.attack) return e; continue; }
      const nav = this.world.infected!.navigation.grid(attacker.transform);
      const found = nav.path(nav.nearestCell(attacker.transform.x, attacker.transform.z), nav.nearestCell(goal.x, goal.z), this.detour, 300);
      const attack = !found || this.detour.length * nav.cellSize > length * 1.5;
      this.decisions.set(attacker.id, { id: e.id, until: this.world.tick + 60, attack, goalX: goal.x, goalZ: goal.z });
      if (attack) return e;
    }
  }
  /** Fixed tick vault over low authored sandbags. Crawlers and heavy archetypes keep attacking. */
  vault(attacker: EntitySnapshot, target?: EntitySnapshot): boolean {
    const brain = attacker.infected!;
    if (!brain.vault && target?.barricade?.slot.sandbag && target.barricade.slot.height < .9 && attacker.archetype === 'infected.runner' && this.withinReach(attacker, target)) {
      const wall = this.wall(target), from = { x: attacker.transform.x, z: attacker.transform.z };
      const alongX = wall.halfZ > wall.halfX;
      const sign = alongX ? Math.sign(wall.x - from.x) || 1 : Math.sign(wall.z - from.z) || 1;
      brain.vault = { started: this.world.tick, from, to: { x: alongX ? wall.x + sign * (wall.halfX + .7) : from.x, z: alongX ? from.z : wall.z + sign * (wall.halfZ + .7) }, height: target.barricade.slot.height };
    }
    const vault = brain.vault; if (!vault) return false;
    const t = Math.min(1, (this.world.tick - vault.started) / 72);
    // Taller wire-topped barriers require lifting clear before traversing, then landing beyond the far face.
    const travel = vault.height >= 1 ? Math.max(0, Math.min(1, (t - .25) / .5)) : t;
    attacker.transform.x = vault.from.x + (vault.to.x - vault.from.x) * travel;
    attacker.transform.z = vault.from.z + (vault.to.z - vault.from.z) * travel;
    attacker.transform.y = .7 + Math.sin(t * Math.PI) * (vault.height + .35);
    this.world.spatial.set(attacker.id, attacker.transform.x, attacker.transform.z);
    if (t === 1) { delete brain.vault; brain.path.length = 0; brain.goal = -1; }
    return true;
  }
  /** Combat distance to the rail face, rather than its midpoint (wide gates remain attackable). */
  withinReach(attacker: EntitySnapshot, target: EntitySnapshot): boolean {
    const w = target.barricade ? this.wall(target) : this.world.props?.navWalls.get(target.id);
    if (!w) return Math.hypot(attacker.transform.x - target.transform.x, attacker.transform.z - target.transform.z) <= 2;
    return Math.hypot(Math.max(0, Math.abs(attacker.transform.x - w.x) - w.halfX), Math.max(0, Math.abs(attacker.transform.z - w.z) - w.halfZ)) <= 1.5;
  }
  /** Approach the near face when crowd spacing pushes an attacker out of reach. */
  approach(attacker: EntitySnapshot, target: EntitySnapshot): { x: number; z: number } {
    const w = target.barricade ? this.wall(target) : this.world.props?.navWalls.get(target.id);
    if (!w) return { x: target.transform.x, z: target.transform.z };
    const pad = (this.world.infected?.nav.clearance ?? .65) + .4;
    const x = Math.max(w.x - w.halfX, Math.min(w.x + w.halfX, attacker.transform.x));
    const z = Math.max(w.z - w.halfZ, Math.min(w.z + w.halfZ, attacker.transform.z));
    const dx = attacker.transform.x - x, dz = attacker.transform.z - z, length = Math.hypot(dx, dz);
    return { x: x + (length ? dx / length : 0) * pad, z: z + (length ? dz / length : -1) * pad };
  }
  /** Defined E07 attack cadence: one hit after windup followed by a one-second cooldown. */
  dps(archetype: string): number { const d = infectedDef(archetype); return d.damage * (archetype === 'infected.brute' ? 5 : archetype === 'infected.butcher' ? 8 : 1) / (d.windup + 1); }
}
