// Zone enter/alert pattern adapted from Bruno Simon folio-2025 Zones.js (MIT, 41046b5).
import { infectedDef, validateInfected } from '../../data/infected';
import { Rng } from '../../core/Rng';
import { Status } from '../combat/Status';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { ScenarioDefinition } from '../../levels/loader';
import { NavGrid } from './NavGrid';
import type { InfectedState } from './types';
export interface InfectedSpawn { state?: InfectedState['state']; yaw?: number; variant?: string; pack?: number; packIndex?: number; perched?: boolean; birds?: number }
/** Fixed-step infected brain. Entities and path storage are prewarmed and reused, without Rapier bodies. */
export class InfectedSystem {
  gore: 'Full' | 'Reduced' | 'Off' = 'Full';
  readonly nav: NavGrid;
  readonly rng: Rng;
  readonly active: EntitySnapshot[] = [];
  readonly pool: EntitySnapshot[] = [];
  readonly counters = { allocated: 0, reused: 0, released: 0 };
  readonly crowd: { transform: EntitySnapshot['transform']; radius: number }[] = [];
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 2 };
  private sequence = 0;
  private budget = 0;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld, definition: ScenarioDefinition) {
    validateInfected(); this.rng = new Rng(world.seed, 'infected'); this.nav = new NavGrid(definition.ground, definition.walls ?? []);
    for (let i = 0; i < 350; i++) {
      const brain: InfectedState = { state: 'idle', activeUntil: 0, speed: 0, until: 0, cooldown: 0, attackId: 0, special: '', hidden: false, deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: 0, packIndex: 0, birds: 0, birdPositions: new Array(60).fill(0), scatterUntil: 0, variant: '', path: [], pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: false };
      this.pool.push({ id: 0, kind: 'infected', archetype: '', faction: 'infected', health: { current: 0, max: 0 }, transform: { x: 0, y: 0.7, z: 0, yaw: 0 }, infected: brain, combat: { radius: 0.35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }); this.counters.allocated++;
    }
    world.events.on('combat.hit', (event) => {
      if (event.type !== 'combat.hit' || event.amount <= 0) return;
      const target = world.entities.get(event.targetId);
      if (target?.infected) {
        target.infected.grabHits++;
        if (target.archetype === 'infected.crow' && (event.actionId.includes('shotgun') || event.actionId.includes('grenade'))) this.hitBirds(target, event.amount);
      }
    });
    world.events.on('combat.attack', (event) => {
      if (event.type !== 'combat.attack' || event.sourceId !== 1) return;
      for (const e of this.active) if (e.infected!.grabUntil > world.tick) {
        if (e.infected!.special === 'cling') e.infected!.grabUntil = 0;
        else if (e.infected!.special === 'pin' && ++e.infected!.grabHits >= 2) e.infected!.grabUntil = 0;
      }
    });
    world.events.on('combat.attack', (event) => { if (event.type === 'combat.attack') this.noise(event.position, event.actionId.includes('pistol') || event.actionId.includes('shotgun') || event.actionId.includes('rifle') ? 25 : 6, event.actionId.includes('shotgun')); });
  }
  spawn(id: string, position: { x: number; z: number }, opts: InfectedSpawn = {}): number {
    const def = infectedDef(id);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !this.nav.clear(position.x, position.z, def.radius)) throw new RangeError('Infected spawn inside collider or outside grid');
    const entity = this.pool.pop(); if (!entity) throw new Error('Infected pool exhausted');
    entity.archetype = id; entity.health.current = entity.health.max = def.hp;
    Object.assign(entity.transform, position); entity.transform.y = 0.7; entity.transform.yaw = opts.yaw ?? 0;
    Object.assign(entity.combat!, { radius: def.radius, armor: 0, shield: def.special === 'shield', staggerUntil: 0, attacking: false, damageMultiplier: 1 }); entity.combat!.statuses.length = 0;
    Object.assign(entity.infected!, { state: opts.state ?? 'idle', activeUntil: 0, speed: def.speed, until: 0, cooldown: 0, attackId: 0, special: def.special, hidden: id === 'infected.cat', deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: opts.pack ?? 0, packIndex: opts.packIndex ?? 0, birds: id === 'infected.crow' ? opts.birds ?? 20 : 0, scatterUntil: 0, variant: opts.variant ?? id, pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: opts.perched ?? id === 'infected.cat' }); entity.infected!.path.length = 0;
    this.world.entities.adopt(entity); this.active.push(entity); this.world.spatial.set(entity.id, position.x, position.z); this.counters.reused++;
    return entity.id;
  }
  release(entity: EntitySnapshot): void {
    const index = this.active.indexOf(entity); if (index < 0) return;
    this.active.splice(index, 1); this.world.entities.delete(entity.id); this.world.spatial.delete(entity.id); this.pool.push(entity); this.counters.released++;
  }
  /** Hearing ignores facing; sight uses a 110° cone and collider line of sight. */
  noise(position: { x: number; z: number }, radius: number, loud = false): void {
    for (const e of this.active) if (e.health.current > 0 && Math.hypot(e.transform.x - position.x, e.transform.z - position.z) <= radius) {
      if (loud && e.archetype === 'infected.crow') { e.infected!.state = 'scatter'; e.infected!.scatterUntil = this.world.tick + 300; }
      else this.alert(e);
    }
  }
  alert(entity: EntitySnapshot): void { if (entity.infected!.state === 'idle' || entity.infected!.state === 'wander') { entity.infected!.state = 'alerted'; entity.infected!.until = this.world.tick + 6; } }
  update(): void {
    const player = this.world.entities.get(1)!; this.budget = 2000;
    if (this.active.length > 20) this.nav.flow(player.transform.x, player.transform.z, 1500);
    this.crowd.length = 0;
    for (const e of this.active) {
      const b = e.infected!; if (e.health.current <= 0) { this.dead(e); continue; }
      if (b.grabUntil > this.world.tick && ((b.special === 'grab' && b.grabHits >= 3) || (b.special === 'cling' && Math.hypot(player.transform.x - b.grabX, player.transform.z - b.grabZ) >= 3))) b.grabUntil = 0;
      const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
      if (b.state === 'idle' || b.state === 'wander') {
        if (distance <= 14 && (distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= Math.cos(55 * Math.PI / 180)) && this.world.combat!.query.visible(e.transform, player.transform)) this.alert(e);
        continue;
      }
      if (b.state === 'alerted') { if (this.world.tick >= b.until) b.state = 'chase'; else continue; }
      if (Status.stunned(e, this.world.tick)) { b.state = 'stagger'; continue; }
      if (b.state === 'stagger') b.state = 'chase';
      if (b.state === 'attack') {
        if (this.world.tick >= b.until && this.resolve(e)) { b.state = 'chase'; b.cooldown = this.world.tick + (b.special === 'scream' ? 300 : 60); e.combat!.attacking = false; }
        continue;
      }
      if (b.state === 'chase') {
        const def = infectedDef(e.archetype);
        let range = def.range;
        if (b.special === 'lunge') range = 2.5;
        if (b.special === 'charge') range = 8;
        if (b.special === 'scream') range = 20;
        if (b.special === 'revive' && this.revivable(e)) range = 20;
        if (distance <= range && this.world.tick >= b.cooldown && this.world.combat!.query.visible(e.transform, player.transform)) { this.windup(e); continue; }
        this.seek(e, player.transform); this.separate(e); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      }
    }
    let corpses = 0;
    for (const e of this.active) if (e.health.current <= 0) corpses++;
    while (corpses > 100) {
      let oldest: EntitySnapshot | undefined;
      for (const e of this.active) if (e.health.current <= 0 && (!oldest || e.infected!.deadAt < oldest.infected!.deadAt)) oldest = e;
      if (oldest) this.release(oldest); corpses--;
    }
    for (let i = this.active.length - 1; i >= 0; i--) if (this.active[i].health.current <= 0 && this.world.tick - this.active[i].infected!.deadAt >= 2760) this.release(this.active[i]);
    // The player consumes borrowed transform references, never renderer state.
    for (const e of this.active) if (e.health.current > 0) this.crowd.push(this.obstacle(e));
    if (this.world.player) this.world.player.locomotion.crowd = this.crowd;
  }
  private readonly obstacles = new WeakMap<EntitySnapshot, { transform: EntitySnapshot['transform']; radius: number }>();
  private obstacle(e: EntitySnapshot) {
    let obstacle = this.obstacles.get(e); if (!obstacle) { obstacle = { transform: e.transform, radius: e.combat!.radius }; this.obstacles.set(e, obstacle); } return obstacle;
  }
  playerSpeedScale(): number {
    for (const e of this.active) if (e.health.current > 0 && e.infected!.grabUntil > this.world.tick && ['grab', 'cling', 'combo-grab'].includes(e.infected!.special)) return 0.5;
    return 1;
  }
  playerPinned(): boolean {
    return this.active.some((e) => e.health.current > 0 && e.infected!.grabUntil > this.world.tick && ['pounce', 'pin'].includes(e.infected!.special));
  }
  private windup(e: EntitySnapshot): void {
    const b = e.infected!, def = infectedDef(e.archetype); b.state = 'attack'; b.attackId = ++this.sequence;
    b.until = this.world.tick + Math.ceil(def.windup * 60); b.activeUntil = b.until + 120; e.combat!.attacking = true;
    const player = this.world.entities.get(1)!; const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
    b.dx = distance ? dx / distance : 1; b.dz = distance ? dz / distance : 0;
    this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: b.special, duration: def.windup });
  }
  private revivable(e: EntitySnapshot): EntitySnapshot | undefined {
    return this.active.find((other) => other.archetype === 'infected.runner' && other.health.current <= 0 && !other.infected!.revived && Math.hypot(e.transform.x - other.transform.x, e.transform.z - other.transform.z) <= 6);
  }
  private resolve(e: EntitySnapshot): boolean {
    const b = e.infected!, player = this.world.entities.get(1)!, def = infectedDef(e.archetype);
    if (b.special === 'scream') { this.noise(e.transform, 20); return true; }
    if (b.special === 'revive' && !b.reviveUsed) {
      const downed = this.revivable(e);
      if (downed) { downed.health.current = downed.health.max; downed.infected!.revived = true; downed.infected!.deadAt = -1; downed.infected!.state = 'chase'; b.reviveUsed = true; this.world.events.emit({ type: 'infected.revived', tick: this.world.tick, sourceId: e.id, targetId: downed.id }); return true; }
    }
    if (b.special === 'lunge' || b.special === 'charge') {
      const distance = Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z);
      const step = Math.min(Math.max(0, distance - def.range), (b.special === 'charge' ? 8 : 7) / 60);
      this.nav.move(e.transform, b.dx * step, b.dz * step, def.radius); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      if (distance > def.range + 0.15) return this.world.tick >= b.activeUntil;
    }
    if (Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z) > def.range + 0.15) return true;
    const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: 1, origin: e.transform, direction: { x: b.dx, z: b.dz }, base: def.damage, multiplier: 1, type: 'melee', knockback: b.special === 'charge' ? 3.2 : 0, stagger: 0 });
    if (['grab', 'combo-grab'].includes(b.special)) { b.grabUntil = this.world.tick + 90; b.grabHits = 0; }
    this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId: 1, special: b.special, amount });
    return true;
  }
  private dead(e: EntitySnapshot): void {
    const b = e.infected!;
    if (b.state !== 'dead') {
      b.state = 'dead'; b.deadAt = this.world.tick; b.grabUntil = 0;
      if (b.special === 'explode') { b.attackId = ++this.sequence; b.until = this.world.tick + 21; this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: 'explode', duration: 0.35 }); }
    }
    if (b.special === 'explode' && this.world.tick === b.until) {
      for (const target of this.world.entities.iterate()) {
        if (target === e || target.health.current <= 0 || Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) > 3 || !this.world.combat!.query.visible(e.transform, target.transform)) continue;
        const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: target.id, origin: e.transform, direction: { x: 0, z: 0 }, base: 35, multiplier: 1, type: 'explosive', knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId: target.id, special: 'explode', amount });
      }
    }
    if (this.world.tick - b.deadAt >= 2700) e.transform.y = 0.7 - (this.world.tick - b.deadAt - 2700) / 60;
  }
  /** Gameplay conversion is independent of gore; renderer reads only the detached flag. */
  loseLeg(id: number, gore: 'Full' | 'Reduced' | 'Off'): void {
    const e = this.world.entities.get(id); if (!e?.infected || e.health.current <= 0 || e.archetype !== 'infected.runner') return;
    e.infected.legLost = true; e.infected.detached = gore === 'Full'; e.infected.speed = 2; e.infected.special = 'grab';
    this.world.events.emit({ type: 'infected.leg-lost', tick: this.world.tick, sourceId: id, targetId: id });
  }
  private hitBirds(e: EntitySnapshot, damage: number): void {
    e.infected!.birds = Math.max(0, e.infected!.birds - Math.floor(damage)); e.health.current = e.infected!.birds;
    if (e.infected!.birds > 0) { e.infected!.state = 'scatter'; e.infected!.scatterUntil = this.world.tick + 300; }
  }
  private seek(e: EntitySnapshot, target: { x: number; z: number }): void {
    const b = e.infected!; let x = target.x, z = target.z;
    const from = this.nav.cell(e.transform.x, e.transform.z), to = this.nav.cell(x, z);
    if (!this.nav.visible(e.transform, target, e.combat!.radius)) {
      let next = from;
      if (this.active.length > 20) next = this.nav.flowNext(from);
      else {
        if ((b.goal !== to || b.pathIndex >= b.path.length) && this.budget > 0) {
          this.nav.path(from, to, b.path, this.budget); this.budget -= this.nav.expansions; b.pathIndex = 0; b.goal = to;
        }
        if (b.pathIndex < b.path.length) {
          while (b.pathIndex + 1 < b.path.length) {
            const candidate = b.path[b.pathIndex + 1];
            this.waypoint.x = this.nav.x(candidate); this.waypoint.z = this.nav.z(candidate);
            if (!this.nav.visible(e.transform, this.waypoint, e.combat!.radius)) break;
            b.pathIndex++;
          }
          next = b.path[b.pathIndex]; if (Math.hypot(this.nav.x(next) - e.transform.x, this.nav.z(next) - e.transform.z) < 0.15) next = b.path[++b.pathIndex] ?? to; }
      }
      if (next < 0 || (this.active.length > 20 && next === from)) return;
      x = this.nav.x(next); z = this.nav.z(next);
    }
    const dx = x - e.transform.x, dz = z - e.transform.z, distance = Math.hypot(dx, dz);
    const remaining = x === target.x && z === target.z ? distance - e.combat!.radius - 0.36 : distance;
    if (remaining < 0.02) return;
    const step = Math.min(remaining, b.speed / 60); this.nav.move(e.transform, dx / distance * step, dz / distance * step, e.combat!.radius);
    e.transform.yaw = -Math.atan2(dz, dx);
  }
  private separate(e: EntitySnapshot): void {
    this.query.x = e.transform.x; this.query.z = e.transform.z; this.world.spatial.query(this.query, this.neighbors);
    for (const id of this.neighbors) {
      const other = this.world.entities.get(id); if (!other || other === e || !other.infected || other.health.current <= 0) continue;
      const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z, distance = Math.hypot(dx, dz), radius = e.combat!.radius + other.combat!.radius;
      if (distance < radius) { const amount = Math.min(0.08, (radius - distance) * 0.5); const angle = (e.id * 2.399963); this.nav.move(e.transform, (distance ? dx / distance : Math.cos(angle)) * amount, (distance ? dz / distance : Math.sin(angle)) * amount, e.combat!.radius); }
    }
  }
}
