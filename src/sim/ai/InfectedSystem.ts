// Zone enter/alert pattern adapted from Bruno Simon folio-2025 Zones.js (MIT, 41046b5).
import { infectedDef, validateInfected } from '../../data/infected';
import { Rng } from '../../core/Rng';
import { Status } from '../combat/Status';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { ScenarioDefinition } from '../../levels/loader';
import { DistrictNavigation } from './DistrictNavigation';
import { PropThrows } from './PropThrows';
import { updateFlock } from './Flock';
import { SpawnDirector } from './SpawnDirector';
import { NavGrid } from './NavGrid';
import type { InfectedState } from './types';
export interface InfectedSpawn { state?: InfectedState['state']; yaw?: number; variant?: string; pack?: number; packIndex?: number; perched?: boolean; birds?: number }
/** Fixed-step infected brain. Entities and path storage are prewarmed and reused, without Rapier bodies. */
export class InfectedSystem {
  gore: 'Full' | 'Reduced' | 'Off' = 'Full';
  readonly navigation: DistrictNavigation;
  readonly props: PropThrows;
  readonly director: SpawnDirector;
  readonly nav: NavGrid;
  readonly rng: Rng;
  readonly active: EntitySnapshot[] = [];
  readonly pool: EntitySnapshot[] = [];
  readonly counters = { allocated: 0, reused: 0, released: 0 };
  readonly perches: NonNullable<ScenarioDefinition['perches']>;
  readonly crowd: { transform: EntitySnapshot['transform']; radius: number }[] = [];
  private readonly neighbors: number[] = [];
  private readonly barricades: EntitySnapshot[] = [];
  private readonly query = { x: 0, z: 0, r: 2 };
  /** E08 calls this for adjacent adult civilians; its rescue/turning lifecycle remains in E08. */
  tryGrabCivilian(sourceId: number, target: { id: number; adult: boolean; variant: string; position: { x: number; z: number } }): { sourceId: number; rescueUntil: number } | null {
    const source = this.world.entities.get(sourceId);
    if (!target.adult || !source?.infected || source.health.current <= 0 || Math.hypot(source.transform.x - target.position.x, source.transform.z - target.position.z) > 1.2 || this.rng.next() >= infectedDef(source.archetype).grabChance) return null;
    this.world.events.emit({ type: 'civilian.grabbed', tick: this.world.tick, sourceId, targetId: target.id, variant: target.variant, rescueUntil: this.world.tick + 90 });
    return { sourceId, rescueUntil: this.world.tick + 90 };
  }
  /** Risen civilians retain their mapped clothes; a capped rise stays queued. Only adults may turn. */
  turnCivilian(target: { adult: boolean; variant: string; archetype: string; position: { x: number; z: number } }): void {
    if (!target.adult) return;
    this.director.requestTurn(target.archetype, target.position, target.variant);
  }
  private sequence = 0;
  private budget = 0;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld, definition: ScenarioDefinition) {
    this.perches = definition.perches ?? [];
    validateInfected(); this.rng = new Rng(world.seed, 'infected'); this.nav = new NavGrid(definition.ground, definition.walls ?? [], 0.65, definition.ground.center); this.navigation = new DistrictNavigation(definition, this.nav); this.director = new SpawnDirector(this); this.props = new PropThrows(world);
    for (let i = 0; i < 350; i++) {
      const brain: InfectedState = { state: 'idle', pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: 0, until: 0, cooldown: 0, attackId: 0, special: '', hidden: false, deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: 0, packIndex: 0, birds: 0, birdPositions: new Array(60).fill(0), birdAlive: new Array(20).fill(0), scatterUntil: 0, variant: '', path: [], pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: false };
      this.pool.push({ id: 0, kind: 'infected', archetype: '', faction: 'infected', health: { current: 0, max: 0 }, transform: { x: 0, y: 0.7, z: 0, yaw: 0 }, infected: brain, combat: { radius: 0.35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }); this.counters.allocated++;
    }
    world.events.on('noise', (event) => { if (event.type === 'noise') this.noise(event.position, event.radius, event.radius >= 25, event.sourceId); });
    world.events.on('combat.hit', (event) => {
      if (event.type !== 'combat.hit' || event.amount <= 0) return;
      const target = world.entities.get(event.targetId);
      if (target?.infected) {
        target.infected.grabHits++;
      }
    });
    world.events.on('combat.attack', (event) => {
      if (event.type !== 'combat.attack' || event.sourceId !== 1) return;
      for (const e of this.active) if (e.infected!.grabUntil > world.tick) {
        if (e.infected!.special === 'cling') e.infected!.grabUntil = 0;
        else if (e.infected!.special === 'pin' && ++e.infected!.grabHits >= 2) e.infected!.grabUntil = 0;
      }
    });
  }
  spawn(id: string, position: { x: number; z: number }, opts: InfectedSpawn = {}): number {
    const def = infectedDef(id);
    let perch: { x: number; z: number; y: number } | undefined;
    if (id === 'infected.cat' && opts.perched !== false && this.perches.length) {
      let distance = Infinity;
      for (const point of this.perches) { const d = Math.hypot(point.x - position.x, point.z - position.z); if (d < distance) { distance = d; perch = point; } }
      position = perch!;
    }
    if (opts.yaw !== undefined && !Number.isFinite(opts.yaw)) throw new RangeError('Invalid infected facing');
    if (id === 'infected.crow' && opts.birds !== undefined && (!Number.isInteger(opts.birds) || opts.birds < 1 || opts.birds > 20)) throw new RangeError('A flock contains 1–20 birds');
    const weight = id === 'infected.crow' ? (opts.birds ?? 20) * 0.25 : 1;
    if (this.director.count + weight > this.director.cap) throw new Error('Infected concurrency cap reached');
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !this.nav.clear(position.x, position.z, def.radius)) throw new RangeError('Infected spawn inside collider or outside grid');
    const entity = this.pool.pop(); if (!entity) throw new Error('Infected pool exhausted');
    entity.archetype = id; entity.health.current = entity.health.max = def.hp;
    Object.assign(entity.transform, position); entity.transform.y = perch?.y ?? 0.7; entity.transform.yaw = opts.yaw ?? 0;
    Object.assign(entity.combat!, { radius: def.radius, armor: 0, shield: def.special === 'shield', staggerUntil: 0, attacking: false, damageMultiplier: 1 }); entity.combat!.statuses.length = 0;
    Object.assign(entity.infected!, { state: opts.state ?? 'idle', pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: def.speed, until: 0, cooldown: 0, attackId: 0, special: def.special, hidden: id === 'infected.cat', deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: opts.pack ?? 0, packIndex: opts.packIndex ?? 0, birds: id === 'infected.crow' ? opts.birds ?? 20 : 0, scatterUntil: 0, variant: opts.variant ?? id, pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: opts.perched ?? id === 'infected.cat' }); entity.infected!.path.length = 0;
    for (let bird = 0; bird < 20; bird++) { entity.infected!.birdAlive[bird] = Number(bird < entity.infected!.birds); entity.infected!.birdPositions[bird * 3] = position.x + Math.cos(bird * 2.399963) * 2; entity.infected!.birdPositions[bird * 3 + 1] = 3; entity.infected!.birdPositions[bird * 3 + 2] = position.z + Math.sin(bird * 2.399963) * 2; }
    if (id === 'infected.crow') entity.health.current = entity.health.max = entity.infected!.birds;
    this.world.entities.adopt(entity); this.active.push(entity); this.world.spatial.set(entity.id, position.x, position.z); this.counters.reused++;
    return entity.id;
  }
  release(entity: EntitySnapshot): void {
    const index = this.active.indexOf(entity); if (index < 0) return;
    this.active.splice(index, 1); this.world.entities.delete(entity.id); this.world.spatial.delete(entity.id); this.pool.push(entity); this.counters.released++;
  }
  /** Hearing ignores facing; sight uses a 110° cone and collider line of sight. */
  noise(position: { x: number; z: number }, radius: number, loud = false, sourceId?: number): void {
    for (const e of this.active) if (e.health.current > 0 && Math.hypot(e.transform.x - position.x, e.transform.z - position.z) <= radius) {
      if (sourceId !== undefined && this.world.combat?.effects.inSmoke(e.transform)) continue;
      if (sourceId !== undefined && (e.infected!.state === 'idle' || e.infected!.state === 'wander')) this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, sourceId, targetId: e.id, cause: 'noise', position: { ...e.transform } });
      if (loud && e.archetype === 'infected.crow') { e.infected!.state = 'scatter'; e.infected!.scatterUntil = this.world.tick + 300; }
      else this.alert(e);
    }
  }
  alert(entity: EntitySnapshot): void { if (entity.infected!.state === 'idle' || entity.infected!.state === 'wander') { entity.infected!.state = 'alerted'; entity.infected!.until = this.world.tick + 6; } }
  update(): void {
    const player = this.world.entities.get(1)!; this.budget = 2000; this.director.update();
    this.barricades.length = 0; for (const e of this.world.entities.iterate()) if (e.kind === 'barricade' && e.health.current > 0) this.barricades.push(e);
    if (this.active.length > 20) this.navigation.flow(player.transform, 1500);
    this.crowd.length = 0;
    for (const e of this.active) {
      const b = e.infected!; if (e.health.current <= 0) { this.dead(e); continue; }
      if (b.grabUntil > this.world.tick && ((b.special === 'grab' && b.grabHits >= 3) || (b.special === 'cling' && Math.hypot(player.transform.x - b.grabX, player.transform.z - b.grabZ) >= 3))) b.grabUntil = 0;
      if (b.special === 'dive') {
        updateFlock(e, this.world.tick, player.transform);
        if (this.world.tick < b.scatterUntil) { b.state = 'scatter'; continue; }
        if (b.state === 'scatter') b.state = 'chase';
      }
      const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
      if (b.special === 'cling' && b.hidden) {
        if (distance > 5) continue;
        b.hidden = false; b.perched = false; b.state = 'chase'; e.transform.y = 0.7;
      }
      if (b.grabUntil > this.world.tick && b.special === 'cling') {
        if (this.world.tick >= b.grabNextTick) { this.attackPlayer(e, 3); b.grabNextTick += 60; }
        e.transform.x = player.transform.x; e.transform.y = player.transform.y + 0.3; e.transform.z = player.transform.z; this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
      if (b.state === 'idle' || b.state === 'wander') {
        if (distance <= 14 && (distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= Math.cos(55 * Math.PI / 180)) && this.world.combat!.query.visible(e.transform, player.transform)) this.alert(e);
        if (b.state === 'wander') {
          this.nav.move(e.transform, b.dx * b.speed / 120, b.dz * b.speed / 120, e.combat!.radius); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
          if (this.world.tick >= b.until) b.state = 'idle';
        } else if (this.world.tick >= 240 && this.world.tick % 240 === e.id % 240) { b.state = 'wander'; b.until = this.world.tick + 120; const angle = this.rng.next() * Math.PI * 2; b.dx = Math.cos(angle); b.dz = Math.sin(angle); }
        continue;
      }
      if (b.state === 'migration') continue;
      if (b.state === 'alerted') { if (this.world.tick >= b.until) b.state = 'chase'; else continue; }
      if (Status.stunned(e, this.world.tick)) { b.state = 'stagger'; continue; }
      if (b.state === 'stagger') b.state = 'chase';
      if (b.state === 'attack') {
        if (this.world.tick >= b.until && this.resolve(e)) { if (b.special === 'combo-grab' && b.combo < 2) { b.combo++; this.windup(e); continue; } b.state = 'chase'; b.cooldown = this.world.tick + (b.special === 'scream' ? 300 : 60); e.combat!.attacking = false; }
        continue;
      }
      if (b.state === 'chase') {
        if (this.world.tick >= b.cooldown) {
          let obstacle: EntitySnapshot | undefined;
          for (const target of this.barricades) if (target.health.current > 0 && Math.hypot(e.transform.x - target.transform.x, e.transform.z - target.transform.z) <= 2) { obstacle = target; break; }
          if (obstacle) { this.windup(e); b.targetId = obstacle.id; continue; }
        }
        const def = infectedDef(e.archetype);
        let range = def.range;
        if (b.special === 'lunge') range = 2.5;
        if (b.special === 'aura') range = 3;
        if (b.special === 'charge') range = 8;
        if (b.special === 'pin') range = 10;
        if (b.special === 'cling') range = 6;
        if (b.special === 'pounce') range = 4;
        if (b.special === 'dive') range = 6;
        if (b.special === 'prop-throw' && this.props.nearestMedium(e)) range = 20;
        if (b.special === 'scream') range = 20;
        if (b.special === 'revive' && this.revivable(e)) range = 20;
        const packAngle = b.packIndex * Math.PI / 2;
        const packReady = !b.pack || b.special !== 'pounce' || (-dx * Math.cos(packAngle) - dz * Math.sin(packAngle)) / Math.max(0.01, distance) >= 0.85;
        if (packReady && distance <= range && this.world.tick >= b.cooldown && this.world.combat!.query.visible(e.transform, player.transform)) { b.combo = 0; this.windup(e); continue; }
        if (b.special === 'pounce' && b.pack && (!packReady || distance > 4)) {
          const angle = b.packIndex * Math.PI / 2; this.waypoint.x = player.transform.x + Math.cos(angle) * 3; this.waypoint.z = player.transform.z + Math.sin(angle) * 3;
          this.seek(e, this.waypoint);
        } else this.seek(e, player.transform); this.separate(e); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
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
    let obstacle = this.obstacles.get(e);
    if (!obstacle) { obstacle = { transform: e.transform, radius: e.combat!.radius }; this.obstacles.set(e, obstacle); }
    else obstacle.radius = e.combat!.radius;
    return obstacle;
  }
  playerSpeedScale(): number {
    for (const e of this.active) {
      const b = e.infected!;
      if (e.health.current > 0 && b.grabUntil > this.world.tick && (b.special === 'grab' || b.special === 'cling' || b.special === 'combo-grab')) return 0.5;
    }
    return 1;
  }
  playerPinned(): boolean {
    for (const e of this.active) {
      const b = e.infected!;
      if (e.health.current > 0 && b.grabUntil > this.world.tick && (b.special === 'pounce' || b.special === 'pin')) return true;
    }
    return false;
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
    if (b.targetId) {
      const target = this.world.entities.get(b.targetId); b.targetId = 0;
      if (target && Math.hypot(e.transform.x - target.transform.x, e.transform.z - target.transform.z) <= 2) {
        const amount = this.world.combat!.damage.apply({ sourceId: e.id, targetId: target.id, attackId: b.attackId, actionId: e.archetype, origin: e.transform, direction: { x: 0, z: 0 }, base: this.barricadeDamage(e.id, def.damage), multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, targetId: target.id, attackId: b.attackId, special: 'barricade', amount });
      }
      return true;
    }
    if (b.special === 'scream') { this.noise(e.transform, 20); return true; }
    if (b.special === 'revive' && !b.reviveUsed) {
      const downed = this.revivable(e);
      if (downed && this.director.count + 1 <= this.director.cap) { downed.health.current = downed.health.max; downed.infected!.revived = true; downed.infected!.deadAt = -1; downed.infected!.state = 'chase'; b.reviveUsed = true; this.world.events.emit({ type: 'infected.revived', tick: this.world.tick, sourceId: e.id, targetId: downed.id }); return true; }
    }
    if (b.special === 'prop-throw' && this.props.launch(e, b.attackId)) return true;
    if (b.special === 'dive') {
      if (this.world.tick - b.until < 120) {
        if ((this.world.tick - b.until) % 30 === 29) this.attackPlayer(e, 5);
        return false;
      }
      return true;
    }
    if (b.special === 'lunge' || b.special === 'charge' || b.special === 'pounce' || b.special === 'cling' || b.special === 'pin') {
      const distance = Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z);
      const step = Math.min(Math.max(0, distance - def.range), (b.special === 'charge' ? 8 : b.special === 'cling' ? 6 : b.special === 'pin' ? 7.5 : 7) / 60);
      if (b.special === 'cling') e.transform.y = 0.7 + Math.sin(Math.min(1, (this.world.tick - b.until) / 60) * Math.PI) * 1.5;
      this.nav.move(e.transform, b.dx * step, b.dz * step, def.radius); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      if (distance > def.range + 0.15) return this.world.tick >= b.activeUntil;
    }
    if (Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z) > (b.special === 'aura' ? 3 : def.range) + 0.15) return true;
    this.attackPlayer(e, def.damage);
    if (b.special === 'aura') this.world.combat!.status.apply(player, { kind: 'toxic', duration: 2, dps: 3, maxStacks: 1, slow: 0.25 }, e.id, e.archetype, b.attackId);
    if (b.special === 'grab' || b.special === 'combo-grab' || b.special === 'cling' || b.special === 'pounce' || b.special === 'pin') {
      b.grabUntil = this.world.tick + (b.special === 'cling' ? 120 : b.special === 'pounce' ? 36 : 90); b.grabHits = 0; b.grabNextTick = this.world.tick + 60; b.grabX = player.transform.x; b.grabZ = player.transform.z;
    }
    return true;
  }
  private attackPlayer(e: EntitySnapshot, damage: number): void {
    const b = e.infected!;
    const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: 1, origin: e.transform, direction: { x: b.dx, z: b.dz }, base: damage, multiplier: 1, type: 'melee', knockback: b.special === 'charge' ? 3.2 : 0, stagger: 0 });
    this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId: 1, special: b.special, amount });
  }
  private dead(e: EntitySnapshot): void {
    const b = e.infected!;
    if (b.state !== 'dead') {
      b.state = 'dead'; b.deadAt = this.world.tick; b.grabUntil = 0;
      if (e.archetype === 'infected.crow') { b.birds = 0; b.birdAlive.fill(0); }
      if (b.special === 'explode') { b.attackId = ++this.sequence; b.until = this.world.tick + 21; this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: 'explode', duration: 0.35 }); }
    }
    if (b.special === 'explode' && this.world.tick === b.until) {
      for (const target of this.world.entities.iterate()) {
        if (target === e || target.health.current <= 0 || Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) > 3 || !this.world.combat!.query.visible(e.transform, target.transform)) continue;
        const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: target.id, origin: e.transform, direction: { x: 0, z: 0 }, base: 35, multiplier: 1, type: 'explosive', radius: 3, knockback: 0, stagger: 0 });
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
  /** Individual blast/cone/ray bird damage, with survivors scattered for five seconds. */
  hitFlock(e: EntitySnapshot, origin: { x: number; z: number }, direction: { x: number; z: number }, radius: number, spread: number): number {
    const b = e.infected!; let killed = 0;
    for (let i = 0; i < 20; i++) if (b.birdAlive[i]) {
      const dx = b.birdPositions[i * 3] - origin.x, dz = b.birdPositions[i * 3 + 2] - origin.z, distance = Math.hypot(dx, dz);
      const along = dx * direction.x + dz * direction.z;
      const inside = spread === 0 ? along >= 0 && Math.abs(dx * direction.z - dz * direction.x) <= 0.2 : spread >= 360 || !distance || along / distance >= Math.cos(spread * Math.PI / 360);
      if (distance <= radius && inside) { b.birdAlive[i] = 0; killed++; if (spread === 0) break; }
    }
    b.birds -= killed;
    if (b.birds > 0) { b.state = 'scatter'; b.scatterUntil = this.world.tick + 300; }
    return killed;
  }
  /** Stable test/debug surface, including RNG and pool/director counters needed for deterministic replay. */
  snapshot() {
    return { rng: this.rng.snapshot(), pool: { ...this.counters, available: this.pool.length }, cap: this.director.cap, count: this.director.count, queued: this.director.queue.map((q) => ({ archetype: q.archetype, position: q.position, options: q.options, turning: q.turning ?? false })), migrations: this.director.migrations.map((m) => ({ started: m.started, arrived: m.arrived, expectedSeconds: m.expectedSeconds, members: m.members })) };
  }
  /** E26 uses the same authored attack damage when resolving barricades. */
  barricadeDamage(sourceId: number, base: number): number { return base * (this.world.entities.get(sourceId)?.archetype === 'infected.gorilla' ? 6 : this.world.entities.get(sourceId)?.archetype === 'infected.brute' ? 5 : 1); }
  private seek(e: EntitySnapshot, target: { x: number; z: number }): void {
    const grid = this.navigation.district(e.transform), b = e.infected!;
    if (b.pathGrid !== grid) { b.pathGrid = grid; b.goal = -1; b.path.length = 0; }
    const nav = this.navigation.grid(e.transform); target = this.navigation.target(e.transform, target);
    let x = target.x, z = target.z;
    const from = nav.cell(e.transform.x, e.transform.z), to = nav.cell(x, z);
    if (!nav.visible(e.transform, target, e.combat!.radius)) {
      let next = from;
      if (this.active.length > 20) next = nav.flowNext(from);
      else {
        if ((b.goal !== to || b.pathIndex >= b.path.length) && this.budget > 0) {
          nav.path(from, to, b.path, this.budget); this.budget -= nav.expansions; b.pathIndex = 0; b.goal = to;
        }
        if (b.pathIndex < b.path.length) {
          while (b.pathIndex + 1 < b.path.length) {
            const candidate = b.path[b.pathIndex + 1];
            this.waypoint.x = nav.x(candidate); this.waypoint.z = nav.z(candidate);
            if (!nav.visible(e.transform, this.waypoint, e.combat!.radius)) break;
            b.pathIndex++;
          }
          next = b.path[b.pathIndex]; if (Math.hypot(nav.x(next) - e.transform.x, nav.z(next) - e.transform.z) < 0.15) next = b.path[++b.pathIndex] ?? to; }
      }
      if (next < 0 || (this.active.length > 20 && next === from)) return;
      x = nav.x(next); z = nav.z(next);
    }
    const dx = x - e.transform.x, dz = z - e.transform.z, distance = Math.hypot(dx, dz);
    const remaining = x === target.x && z === target.z ? distance - e.combat!.radius - 0.36 : distance;
    if (remaining < 0.02) return;
    const step = Math.min(remaining, b.speed / 60); this.nav.move(e.transform, dx / distance * step, dz / distance * step, e.combat!.radius);
    e.transform.yaw = -Math.atan2(dz, dx);
  }
  private separate(e: EntitySnapshot): void {
    this.query.x = e.transform.x; this.query.z = e.transform.z; this.query.r = e.combat!.radius + 0.7; this.world.spatial.query(this.query, this.neighbors, false);
    for (const id of this.neighbors) {
      const other = this.world.entities.get(id); if (!other || other === e || !other.infected || other.health.current <= 0) continue;
      const dx = e.transform.x - other.transform.x, dz = e.transform.z - other.transform.z, squared = dx * dx + dz * dz, radius = e.combat!.radius + other.combat!.radius;
      if (squared < radius * radius) { const distance = Math.sqrt(squared), amount = Math.min(0.08, (radius - distance) * 0.5); const angle = (e.id * 2.399963); this.nav.move(e.transform, (distance ? dx / distance : Math.cos(angle)) * amount, (distance ? dz / distance : Math.sin(angle)) * amount, e.combat!.radius); }
    }
  }
}
