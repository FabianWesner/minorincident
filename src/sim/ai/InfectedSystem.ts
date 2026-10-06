import { installAgentMotion, moveAgent } from '../locomotion/AgentMotion';
import { motionResponse } from '../locomotion/MotionResponse';
import { installCharacterSeparation } from './CharacterSeparation';
import { noise } from '../../data/noise';
// Zone enter/alert pattern adapted from Bruno Simon folio-2025 Zones.js (MIT, 41046b5).
import { infectedDef, l1SpeedTier, l1TierSpeed, validateInfected, type InfectedSpeedTier } from '../../data/infected';
import { l1v2 } from '../../data/l1v2';
import { groveDistrictId } from '../../levels/districts/types';
import type { DistractionEvent, HumanTarget, HumanTargetQuery } from '../outbreak/types';
import { Perception, WorldHumans } from './Perception';
import { planSearch, searchPlan, wanderGoal, type L1Brain } from './Search';
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
export interface InfectedSpawn { state?: InfectedState['state']; yaw?: number; variant?: string; pack?: number; packIndex?: number; perched?: boolean; birds?: number; /** L1 v2 speed tier; derived from the variant when omitted. */ tier?: InfectedSpeedTier }
const l1Ticks = (seconds: number) => Math.round(seconds * 60);
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
    if (this.l1) return null; // L1 v2 bites come from the infected brain (BiteEvent), not from civilian proximity rolls.
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
  private routes = 0;
  private readonly lureTarget = { x: 0, z: 0 };
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld, definition: ScenarioDefinition) {
    this.perches = definition.perches ?? [];
    installCharacterSeparation(world); installAgentMotion(world);
    validateInfected(); this.rng = new Rng(world.seed, 'infected'); this.nav = new NavGrid(definition.ground, definition.walls ?? [], definition.navigationClearance ?? 0.65, definition.ground.center); this.navigation = new DistrictNavigation(definition, this.nav); this.director = new SpawnDirector(this); this.props = new PropThrows(world);
    for (let i = 0; i < 350; i++) {
      const brain: InfectedState = { state: 'idle', pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: 0, until: 0, cooldown: 0, attackId: 0, special: '', hidden: false, deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: 0, packIndex: 0, birds: 0, birdPositions: new Array(60).fill(0), birdAlive: new Array(20).fill(0), scatterUntil: 0, variant: '', path: [], pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: false };
      this.pool.push({ id: 0, kind: 'infected', archetype: '', faction: 'infected', health: { current: 0, max: 0 }, transform: { x: 0, y: 0.7, z: 0, yaw: 0 }, infected: brain, combat: { radius: 0.35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }); this.counters.allocated++;
    }
    world.events.on('world.blocker.changed', (event) => {
      if (event.type !== 'world.blocker.changed') return;
      this.nav.setBlocker(event.id, event.wall, event.blocked);
      for (const district of this.navigation.districts) district.grid.setBlocker(event.id, event.wall, event.blocked);
      for (const entity of this.active) { entity.infected!.goal = -1; entity.infected!.path.length = 0; delete entity.infected!.birdMotion; delete entity.infected!.birdVertical; }
    });
    world.events.on('noise', (event) => { if (event.type === 'noise') this.noise(event.position, event.radius, event.radius >= 25, event.sourceId); });
    world.events.on('outbreak.distraction', (event) => { if (event.type === 'outbreak.distraction') this.distraction(event); });
    if (world.districts?.districts.some((d) => d.id === groveDistrictId)) this.configureL1v2();
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
  /** The director validates the same authored perch that spawn will use. */
  perchFor(id: string, position: { x: number; z: number }, perched?: boolean): { x: number; z: number; y: number } | undefined {
    if (id !== 'infected.cat' || perched === false) return;
    let closest: { x: number; z: number; y: number } | undefined, distance = Infinity;
    for (const point of this.perches) { const d = Math.hypot(point.x - position.x, point.z - position.z); if (d < distance) { distance = d; closest = point; } }
    return closest;
  }
  spawn(id: string, position: { x: number; z: number }, opts: InfectedSpawn = {}): number {
    const def = infectedDef(id);
    const perch = this.perchFor(id, position, opts.perched);
    if (perch) position = perch;
    if (opts.yaw !== undefined && !Number.isFinite(opts.yaw)) throw new RangeError('Invalid infected facing');
    if (id === 'infected.crow' && opts.birds !== undefined && (!Number.isInteger(opts.birds) || opts.birds < 1 || opts.birds > 20)) throw new RangeError('A flock contains 1–20 birds');
    const weight = id === 'infected.crow' ? (opts.birds ?? 20) * 0.25 : 1;
    if (this.director.count + weight > this.director.cap) throw new Error('Infected concurrency cap reached');
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !this.nav.clear(position.x, position.z, def.radius)) throw new RangeError('Infected spawn inside collider or outside grid');
    const entity = this.pool.pop(); if (!entity) throw new Error('Infected pool exhausted');
    entity.locomotion = motionResponse(); delete entity.motion;
    delete entity.infectionRise; delete entity.noiseTarget; delete entity.attachedTo; delete entity.hidden;
    entity.archetype = id; entity.health.current = entity.health.max = def.hp;
    Object.assign(entity.transform, position); entity.transform.y = perch?.y ?? 0.7; entity.transform.yaw = opts.yaw ?? 0;
    Object.assign(entity.combat!, { radius: def.radius, armor: 0, shield: def.special === 'shield', staggerUntil: 0, attacking: false, damageMultiplier: 1 }); entity.combat!.statuses.length = 0; delete entity.combat!.reaction;
    Object.assign(entity.infected!, { state: opts.state ?? 'idle', pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: def.speed, until: 0, cooldown: 0, attackId: 0, special: def.special, hidden: id === 'infected.cat', deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: opts.pack ?? 0, packIndex: opts.packIndex ?? 0, birds: id === 'infected.crow' ? opts.birds ?? 20 : 0, scatterUntil: 0, variant: opts.variant ?? id, pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: opts.perched ?? id === 'infected.cat' }); entity.infected!.path.length = 0; delete entity.infected!.birdMotion; delete entity.infected!.birdVertical;
    for (let bird = 0; bird < 20; bird++) { entity.infected!.birdAlive[bird] = Number(bird < entity.infected!.birds); entity.infected!.birdPositions[bird * 3] = position.x + Math.cos(bird * 2.399963) * 2; entity.infected!.birdPositions[bird * 3 + 1] = 3; entity.infected!.birdPositions[bird * 3 + 2] = position.z + Math.sin(bird * 2.399963) * 2; }
    if (id === 'infected.crow') entity.health.current = entity.health.max = entity.infected!.birds;
    if (this.l1 && def.special === 'lunge') this.initL1(entity, opts.tier ?? l1SpeedTier(entity.infected!.variant)); else delete entity.infected!.l1;
    this.world.entities.adopt(entity); this.active.push(entity); this.world.spatial.set(entity.id, position.x, position.z); this.counters.reused++;
    return entity.id;
  }
  release(entity: EntitySnapshot): void {
    const index = this.active.indexOf(entity); if (index < 0) return;
    this.active.splice(index, 1); this.world.entities.delete(entity.id); this.world.spatial.delete(entity.id); this.pool.push(entity); this.counters.released++;
  }
  /** Hearing ignores facing; sight uses a 110° cone and collider line of sight. */
  noise(position: { x: number; z: number }, radius: number, loud = false, sourceId?: number): void {
    if (this.l1 && !l1v2.infected.hearsPlayer) return; // L1: vision only; deliberate loud events arrive as DistractionEvent.
    for (const e of this.active) if (e.health.current > 0 && Math.hypot(e.transform.x - position.x, e.transform.z - position.z) <= radius) {
      if (sourceId !== undefined && this.world.combat?.effects.inSmoke(e.transform)) continue;
      if (sourceId !== undefined && (e.infected!.state === 'idle' || e.infected!.state === 'wander')) this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, sourceId, targetId: e.id, cause: 'noise', position: { ...e.transform } });
      if (loud && e.archetype === 'infected.crow') { e.infected!.state = 'scatter'; e.infected!.scatterUntil = this.world.tick + 300; }
      else this.alert(e);
    }
  }
  alert(entity: EntitySnapshot): void { if (entity.infected!.state === 'idle' || entity.infected!.state === 'wander') { entity.infected!.state = 'alerted'; entity.infected!.until = this.world.tick + 6; } }
  update(): void {
    const player = this.world.entities.get(1)!; this.budget = 2000; this.routes = 0; this.director.update();
    this.barricades.length = 0; for (const e of this.world.entities.iterate()) if (e.kind === 'barricade' && e.health.current > 0) this.barricades.push(e);
    if (this.active.length > 20) this.navigation.flow(player.transform, 1500);
    this.crowd.length = 0;
    for (const e of this.active) {
      if (this.world.npcs?.civilians.holds(e.id)) { e.combat!.attacking = false; continue; }
      const b = e.infected!; if (e.health.current <= 0) { this.dead(e); continue; }
      if (e.infectionRise && this.world.tick < e.infectionRise.until) { e.combat!.attacking = false; continue; }
      if (e.attachedTo !== undefined) { e.combat!.attacking = false; continue; }
      if (b.l1) { this.updateL1(e, b, b.l1); continue; }
      const lure = e.noiseTarget && this.world.tick < e.noiseTarget.until ? this.world.entities.get(e.noiseTarget.id) : undefined;
      if (lure && b.state !== 'migration' && !Status.stunned(e, this.world.tick)) {
        b.state = 'chase'; e.combat!.attacking = false;
        const dx = e.transform.x - lure.transform.x, dz = e.transform.z - lure.transform.z, distance = Math.hypot(dx, dz);
        const stop = (lure.combat?.radius ?? .6) + this.nav.clearance + this.nav.cellSize;
        if (distance > stop + .5) {
          this.lureTarget.x = lure.transform.x + dx / distance * stop; this.lureTarget.z = lure.transform.z + dz / distance * stop;
          this.seek(e, this.lureTarget);
        }
        this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
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
          moveAgent(e, b.dx * b.speed / 2, b.dz * b.speed / 2, this.nav, this.world.tick); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
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
    if (b.special === 'scream') { this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId: e.id, actionId: e.archetype, position: { ...e.transform }, ...noise.scream, kind: 'scream' }); return true; }
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
      // Authored leap/charge timing is a combat impulse, like knockback.
      moveAgent(e, b.dx * step * 60, b.dz * step * 60, this.nav, this.world.tick, e.combat!.radius, true); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
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
    const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: 1, origin: e.transform, direction: { x: b.dx, z: b.dz }, base: damage, multiplier: e.combat!.damageMultiplier, type: 'melee', knockback: b.special === 'charge' ? 3.2 : 0, stagger: 0 });
    this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId: 1, special: b.special, amount });
  }
  private dead(e: EntitySnapshot): void {
    const b = e.infected!;
    if (b.state !== 'dead') {
      b.state = 'dead'; b.deadAt = this.world.tick; b.grabUntil = 0;
      if (e.archetype === 'infected.crow') { b.birds = 0; b.birdAlive.fill(0); }
      if (b.special === 'explode') { b.attackId = ++this.sequence; b.until = this.world.tick + 60; this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: 'explode', duration: 1 }); }
    }
    if (b.special === 'explode' && this.world.tick === b.until) {
      for (const target of this.world.entities.iterate()) {
        if (target.civilian?.adult === false || target.escort?.child || target === e || target.health.current <= 0 || Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) > 3 || !this.world.combat!.query.visible(e.transform, target.transform)) continue;
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
  // ---- L1 v2 brain (specs/epic-19 sections 5.2-5.4): vision only, closest visible human, chase/lunge/bite,
  // randomised search, wander, attracted by deliberate distractions, speed tiers. All randomness from `l1Rng`.
  /** Vision, LOS blockers and the human query of L1; null outside L1. */
  l1: Perception | null = null;
  private l1Rng: Rng | null = null;
  private readonly tierStart = { frail: 0, average: 0, athletic: 0 };
  private readonly tierCount = { frail: 0, average: 0, athletic: 0 };
  private readonly recentTurns: number[] = [];
  /** Enables the L1 brain for every human infected spawned from now on (D-GROVE enables it automatically). */
  configureL1v2(humans?: HumanTargetQuery): Perception {
    if (!this.l1) {
      this.l1 = new Perception(this.world); this.l1Rng = new Rng(this.world.seed, 'infected-l1');
      for (const tier of ['frail', 'average', 'athletic'] as const) this.tierStart[tier] = this.l1Rng.next();
    }
    if (humans) this.l1.humans = humans;
    return this.l1;
  }
  private initL1(e: EntitySnapshot, tier: InfectedSpeedTier): void {
    // Per-tier golden-ratio sequence from a seeded start: jitter is uniform over the run, fixed per entity, and
    // infected of one tier spawned together never share a speed (no synchronized group).
    const u = (this.tierStart[tier] + this.tierCount[tier]++ * 0.6180339887498949) % 1, rng = this.l1Rng!;
    const brain: L1Brain = e.infected!.l1 ?? { mode: 'wander', tier, runSpeed: 0, wanderSpeed: 0, targetId: 0, seenX: 0, seenZ: 0, seenTick: 0, headingX: 0, headingZ: 0, looking: false, lookYaw: 0, pauseUntil: 0, goalX: 0, goalZ: 0, hasGoal: false, search: searchPlan(), episodes: 0, distractionId: 0, biteTargetId: 0, direct: false, directTick: -1, directX: 0, directZ: 0 };
    const [low, high] = l1v2.infected.wanderSpeed;
    Object.assign(brain, { mode: 'wander', tier, runSpeed: l1TierSpeed(tier, u), wanderSpeed: low + rng.next() * (high - low), targetId: 0, headingX: 0, headingZ: 0, looking: true, lookYaw: e.transform.yaw, pauseUntil: this.world.tick + 20 + Math.floor(rng.next() * 40), hasGoal: false, episodes: 0, distractionId: 0, biteTargetId: 0, directTick: -1 });
    brain.search.until = 0;
    e.infected!.l1 = brain; e.infected!.speed = brain.runSpeed; e.infected!.state = 'wander';
  }
  /** Live L1 speed of an infected (for tests, bots and animation): its tier run speed. */
  l1Speed(id: number): number { return this.world.entities.get(id)?.infected?.l1?.runSpeed ?? 0; }
  /** Infected currently holding `civilianId` in a bite grab, or 0. Lane D freezes the victim while this is set. */
  holding(civilianId: number): number {
    for (const e of this.active) if (e.infected!.l1?.mode === 'bite' && e.infected!.l1.biteTargetId === civilianId && e.health.current > 0) return e.id;
    return 0;
  }
  /**
   * Sends an L1 infected running to a point, then searching around it until `untilTick` (distractions, accident exits,
   * director steering). Ignored while it chases or bites.
   */
  rush(id: number, point: { x: number; z: number }, untilTick: number, distractionId = 0): boolean {
    const e = this.world.entities.get(id), brain = e?.infected?.l1;
    if (!e || !brain || e.health.current <= 0 || brain.mode === 'chase' || brain.mode === 'bite' || e.infected!.state === 'attack') return false;
    const rng = this.l1Rng!, radius = l1v2.infected.attracted.pointRadiusM;
    brain.goalX = point.x; brain.goalZ = point.z;
    for (let k = 0; k < 6; k++) {
      const angle = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * radius, x = point.x + Math.cos(angle) * r, z = point.z + Math.sin(angle) * r;
      if (this.nav.clear(x, z, e.combat!.radius)) { brain.goalX = x; brain.goalZ = z; break; }
    }
    brain.mode = 'attracted'; e.infected!.state = 'attracted'; brain.hasGoal = true; brain.looking = false; brain.pauseUntil = 0; brain.distractionId = distractionId;
    brain.search.until = untilTick; brain.search.originX = point.x; brain.search.originZ = point.z; brain.search.legTicks = 0;
    return true;
  }
  private distraction(event: DistractionEvent): void {
    if (!this.l1) return;
    const [low, high] = l1v2.infected.attracted.extraS, rng = this.l1Rng!;
    for (const e of this.active) {
      const brain = e.infected!.l1;
      if (!brain || e.health.current <= 0 || brain.distractionId === event.id) continue;
      if (Math.hypot(e.transform.x - event.position.x, e.transform.z - event.position.z) > event.radius) continue;
      this.rush(e.id, event.position, event.until + l1Ticks(low + rng.next() * (high - low)), event.id);
    }
  }
  private updateL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const tick = this.world.tick;
    if (Status.stunned(e, tick)) {
      if (brain.mode === 'bite') this.endBite(e, b, brain, false);
      if (b.state === 'attack') { b.state = 'chase'; e.combat!.attacking = false; }
      return;
    }
    if (b.state === 'attack') {
      if (tick >= b.until && this.resolve(e)) { b.state = 'chase'; b.cooldown = tick + Math.max(0, l1Ticks(l1v2.infected.attackCycleS) - Math.ceil(infectedDef(e.archetype).windup * 60)); e.combat!.attacking = false; }
      return;
    }
    if (brain.mode === 'bite') { this.updateBite(e, b, brain); return; }
    if ((tick + e.id) % l1Ticks(l1v2.infected.targetReevalS) === 0) this.perceive(e, b, brain);
    if (brain.mode === 'chase') this.chaseL1(e, b, brain);
    else if (brain.mode === 'attracted') this.attractedL1(e, b, brain);
    else if (brain.mode === 'search') this.searchL1(e, b, brain);
    else this.wanderL1(e, b, brain);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  /** Re-evaluates the closest visible human (0.25 s cadence); losing every human while chasing starts a search. */
  private perceive(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const seen = this.l1!.closest(e, brain.mode === 'chase' ? brain.targetId : 0);
    if (seen) { this.sight(e, b, brain, seen); return; }
    if (brain.mode === 'chase') this.startSearch(b, brain, { x: brain.seenX, z: brain.seenZ }, { x: brain.headingX, z: brain.headingZ });
  }
  private sight(e: EntitySnapshot, b: InfectedState, brain: L1Brain, seen: HumanTarget): void {
    const tick = this.world.tick;
    if (brain.mode === 'chase' && brain.targetId === seen.id) {
      const dx = seen.position.x - brain.seenX, dz = seen.position.z - brain.seenZ, d = Math.hypot(dx, dz);
      if (d > 0.05) { brain.headingX = dx / d; brain.headingZ = dz / d; }
    } else {
      // A fresh sighting from calm: a brief readable "notice" beat (stop, snap toward the human), then the run.
      // Searching infected are already hunting and re-acquire without it.
      if (brain.mode === 'wander' || (brain.mode === 'search' && brain.distractionId !== 0) || brain.mode === 'attracted') { brain.pauseUntil = tick + 12; brain.looking = true; brain.lookYaw = -Math.atan2(seen.position.z - e.transform.z, seen.position.x - e.transform.x); }
      brain.headingX = brain.headingZ = 0; brain.distractionId = 0;
      this.world.events.emit({ type: 'ai.alerted', tick, sourceId: seen.id, targetId: e.id, cause: 'sight', position: { ...e.transform } });
    }
    brain.mode = 'chase'; b.state = 'chase'; brain.targetId = seen.id; brain.seenX = seen.position.x; brain.seenZ = seen.position.z; brain.seenTick = tick;
  }
  private startSearch(b: InfectedState, brain: L1Brain, origin: { x: number; z: number }, heading: { x: number; z: number }): void {
    const [low, high] = l1v2.infected.search.durationS, rng = this.l1Rng!;
    planSearch(brain.search, rng, this.nav, this.world.tick, origin, heading, l1Ticks(low + rng.next() * (high - low)));
    brain.mode = 'search'; b.state = 'search'; brain.targetId = 0; brain.looking = false; brain.pauseUntil = 0; brain.episodes++;
  }
  private chaseL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const target = this.l1!.humans.get(brain.targetId);
    if (!target) { this.startSearch(b, brain, { x: brain.seenX, z: brain.seenZ }, { x: brain.headingX, z: brain.headingZ }); return; }
    if (this.world.tick < brain.pauseUntil) { this.look(e, brain); return; }
    brain.looking = false;
    const distance = Math.hypot(target.position.x - e.transform.x, target.position.z - e.transform.z), lunge = l1v2.infected.lungeRangeM;
    if (target.kind === 'player') {
      if (distance <= lunge && this.world.tick >= b.cooldown && this.l1!.lineOfSight(e.transform, target.position)) { b.combo = 0; this.windup(e); return; }
      this.steerL1(e, brain, target.position, brain.runSpeed, true, true);
      return;
    }
    // Civilians: runner lunge burst inside 2.5 m, then grab on contact.
    const contact = e.combat!.radius + 0.35 + 0.3;
    if (distance <= contact) { this.startBite(e, b, brain, target); return; }
    this.steerL1(e, brain, target.position, distance <= lunge ? Math.min(7, brain.runSpeed * 1.25) : brain.runSpeed, false, true);
  }
  private startBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain, target: HumanTarget): void {
    const tick = this.world.tick, victim = this.world.entities.get(target.id);
    brain.mode = 'bite'; b.state = 'bite'; brain.biteTargetId = target.id; b.grabHits = 0; b.grabUntil = tick + l1Ticks(l1v2.civilians.grabS); e.combat!.attacking = true;
    e.transform.yaw = -Math.atan2(target.position.z - e.transform.z, target.position.x - e.transform.x);
    this.world.events.emit({ type: 'civilian.grabbed', tick, sourceId: e.id, targetId: target.id, variant: victim?.civilian?.variant ?? victim?.archetype ?? '', rescueUntil: b.grabUntil });
  }
  private updateBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const victim = this.l1!.humans.get(brain.biteTargetId)?.position;
    // Any hit on the infected during the grab rescues the victim (rescue window = the 1.0 s grab).
    if (b.grabHits > 0 || !victim || Math.hypot(victim.x - e.transform.x, victim.z - e.transform.z) > 1.8) { this.endBite(e, b, brain, false); return; }
    e.transform.yaw = -Math.atan2(victim.z - e.transform.z, victim.x - e.transform.x);
    if (this.world.tick >= b.grabUntil) this.endBite(e, b, brain, true);
  }
  private endBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain, bitten: boolean): void {
    const tick = this.world.tick, victimId = brain.biteTargetId, victim = this.l1!.humans.get(victimId)?.position;
    b.grabUntil = 0; e.combat!.attacking = false; brain.biteTargetId = 0;
    if (bitten && victim) {
      while (this.recentTurns.length && tick - this.recentTurns[0] > l1Ticks(l1v2.civilians.transformS + l1v2.civilians.transformJitterS)) this.recentTurns.shift();
      const cap = this.director.tier === 'low' ? l1v2.director.capLow : l1v2.director.capHigh, turns = this.director.count + this.recentTurns.length < cap;
      if (turns) this.recentTurns.push(tick);
      if (this.l1!.humans instanceof WorldHumans) this.l1!.humans.bitten.add(victimId);
      this.world.events.emit({ type: 'outbreak.bite', tick, sourceId: e.id, targetId: victimId, position: { x: victim.x, z: victim.z }, turns });
    }
    // Back to the closest visible human at once (switch back to the player after a bite); else look around.
    brain.mode = 'wander'; b.state = 'wander'; brain.targetId = 0; brain.hasGoal = false;
    brain.looking = true; brain.lookYaw = e.transform.yaw + Math.PI * 0.6; brain.pauseUntil = tick + (bitten ? 30 : 24);
    this.perceive(e, b, brain);
  }
  private attractedL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const s = brain.search, tick = this.world.tick;
    if (tick >= s.until) { this.toWander(e, b, brain); return; }
    const distance = Math.hypot(brain.goalX - e.transform.x, brain.goalZ - e.transform.z);
    if (distance <= 1 || ++s.legTicks > 600) {
      // Arrived at the sound: search around it (same behaviour, centred on the source) until the attraction ends.
      planSearch(s, this.l1Rng!, this.nav, tick, { x: s.originX, z: s.originZ }, { x: 0, z: 0 }, s.until - tick, [3, 7]);
      s.next = 0; brain.mode = 'search'; b.state = 'attracted'; brain.looking = true; brain.lookYaw = e.transform.yaw + 1.2; brain.pauseUntil = tick + 30;
      return;
    }
    this.steerL1(e, brain, { x: brain.goalX, z: brain.goalZ }, brain.runSpeed * 0.85);
  }
  private searchL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const s = brain.search, tick = this.world.tick, rng = this.l1Rng!;
    if (tick >= s.until) { this.toWander(e, b, brain); return; }
    if (tick < brain.pauseUntil) { this.look(e, brain); return; }
    brain.looking = false;
    if (s.next >= 0 && s.next * 2 >= s.probes.length) this.extendSearch(s, rng);
    const tx = s.next < 0 ? s.originX : s.probes[s.next * 2], tz = s.next < 0 ? s.originZ : s.probes[s.next * 2 + 1];
    const distance = Math.hypot(tx - e.transform.x, tz - e.transform.z), arrived = distance <= 1.2;
    if (arrived || ++s.legTicks > 180) {
      if (arrived && s.next >= 0) { if (s.next === s.doubleBackAt) s.doubledBack = true; else s.visited++; }
      s.next++; s.legTicks = 0;
      // Look around before moving on: sweep away from the arrival direction, then back (lane G plays the head sweep).
      brain.looking = true; brain.lookYaw = e.transform.yaw + (rng.next() < 0.5 ? -1 : 1) * (0.9 + rng.next() * 1.0);
      brain.pauseUntil = tick + 18 + Math.floor(rng.next() * 30);
      return;
    }
    this.steerL1(e, brain, { x: tx, z: tz }, s.next < 0 ? brain.runSpeed : brain.runSpeed * 0.7);
  }
  /** Keeps a long search busy: one more probe 4-12 m around the origin. */
  private extendSearch(s: L1Brain['search'], rng: Rng): void {
    const [low, high] = l1v2.infected.search.probeRadiusM;
    for (let k = 0; k < 6; k++) {
      const angle = rng.next() * Math.PI * 2, r = low + rng.next() * (high - low), x = s.originX + Math.cos(angle) * r, z = s.originZ + Math.sin(angle) * r;
      if (this.nav.clear(x, z, 0.45)) { s.probes.push(x, z); return; }
    }
    s.probes.push(s.originX + 4, s.originZ);
  }
  private toWander(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    brain.mode = 'wander'; b.state = 'wander'; brain.hasGoal = false; brain.distractionId = 0;
    brain.looking = true; brain.lookYaw = e.transform.yaw + Math.PI * (this.l1Rng!.next() - 0.5); brain.pauseUntil = this.world.tick + 60 + Math.floor(this.l1Rng!.next() * 60);
  }
  private wanderL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const tick = this.world.tick, rng = this.l1Rng!;
    if (tick < brain.pauseUntil) { this.look(e, brain); return; }
    brain.looking = false;
    if (!brain.hasGoal) { if (!wanderGoal(brain, rng, this.nav, e.transform)) { brain.pauseUntil = tick + 30; return; } brain.search.legTicks = 0; }
    const distance = Math.hypot(brain.goalX - e.transform.x, brain.goalZ - e.transform.z);
    if (distance <= 0.8 || ++brain.search.legTicks > 900) {
      brain.hasGoal = false; brain.looking = true; brain.lookYaw = e.transform.yaw + (rng.next() - 0.5) * 2.6;
      brain.pauseUntil = tick + 60 + Math.floor(rng.next() * 150);
      return;
    }
    this.steerL1(e, brain, { x: brain.goalX, z: brain.goalZ }, brain.wanderSpeed);
  }
  /** Standing look-around: turn the body toward `lookYaw` at a bounded rate, then sweep back the other way. */
  private look(e: EntitySnapshot, brain: L1Brain): void {
    const delta = Math.atan2(Math.sin(brain.lookYaw - e.transform.yaw), Math.cos(brain.lookYaw - e.transform.yaw)), step = 3.2 / 60;
    if (Math.abs(delta) <= step) { e.transform.yaw = brain.lookYaw; if (brain.mode !== 'chase') brain.lookYaw = e.transform.yaw - Math.sign(delta || 1) * (0.8 + this.l1Rng!.next() * 0.9); }
    else e.transform.yaw += Math.sign(delta) * step;
  }
  /** Stable test/debug surface, including RNG and pool/director counters needed for deterministic replay. */
  snapshot() {
    return { rng: this.rng.snapshot(), pool: { ...this.counters, available: this.pool.length }, cap: this.director.cap, count: this.director.count, queued: this.director.queue.map((q) => ({ archetype: q.archetype, position: q.position, options: q.options, turning: q.turning ?? false })), migrations: this.director.migrations.map((m) => ({ started: m.started, arrived: m.arrived, expectedSeconds: m.expectedSeconds, members: m.members })) };
  }
  /** E26 uses the same authored attack damage when resolving barricades. */
  barricadeDamage(sourceId: number, base: number): number { return base * (this.world.entities.get(sourceId)?.archetype === 'infected.gorilla' ? 6 : this.world.entities.get(sourceId)?.archetype === 'infected.brute' ? 5 : 1); }
  /**
   * L1 steering under the motion limits: straight when the goal is in clear view (re-checked every 6 ticks or when the
   * goal moved), else a budgeted A* route (at most 4 new routes per tick; moving goals re-route every 0.25 s), or the
   * shared flow field when chasing the survivor in a crowd. `pursue` keeps full speed onto a moving human.
   */
  private steerL1(e: EntitySnapshot, brain: L1Brain, goal: { x: number; z: number }, speed: number, survivor = false, pursue = false): void {
    const b = e.infected!, tick = this.world.tick, radius = e.combat!.radius, grid = this.navigation.district(e.transform);
    if (b.pathGrid !== grid) { b.pathGrid = grid; b.goal = -1; b.path.length = 0; }
    const nav = this.navigation.grid(e.transform), target = this.navigation.target(e.transform, goal);
    if ((tick + e.id) % 6 === 0 || brain.directTick < 0 || Math.hypot(target.x - brain.directX, target.z - brain.directZ) > 1.5) {
      brain.direct = nav.visible(e.transform, target, radius); brain.directTick = tick; brain.directX = target.x; brain.directZ = target.z;
    }
    let x = target.x, z = target.z;
    if (!brain.direct) {
      const from = nav.nearestCell(e.transform.x, e.transform.z);
      let next = -1;
      if (survivor && this.active.length > 20) next = nav.flowNext(from);
      else {
        const to = nav.nearestCell(target.x, target.z);
        const stale = b.pathIndex >= b.path.length || (b.goal !== to && (tick + e.id) % 15 === 0);
        if (stale && this.budget > 0 && this.routes < 4) { this.routes++; nav.path(from, to, b.path, this.budget); this.budget -= nav.expansions; b.pathIndex = 0; b.goal = to; }
        while (b.pathIndex < b.path.length && Math.hypot(nav.x(b.path[b.pathIndex]) - e.transform.x, nav.z(b.path[b.pathIndex]) - e.transform.z) < 0.6) b.pathIndex++;
        if ((tick + e.id) % 3 === 0 && b.pathIndex + 2 < b.path.length) {
          this.waypoint.x = nav.x(b.path[b.pathIndex + 2]); this.waypoint.z = nav.z(b.path[b.pathIndex + 2]);
          if (nav.visible(e.transform, this.waypoint, radius)) b.pathIndex += 2;
        }
        next = b.pathIndex < b.path.length ? b.path[b.pathIndex] : -1;
      }
      if (next >= 0 && next !== from) { x = nav.x(next); z = nav.z(next); }
    }
    const dx = x - e.transform.x, dz = z - e.transform.z, distance = Math.hypot(dx, dz);
    const remaining = x === target.x && z === target.z ? distance - (pursue ? radius + 0.36 : 0) : distance;
    if (remaining < 0.02) return;
    const velocity = Math.min(speed, remaining * (pursue ? 60 : 2)); moveAgent(e, dx / distance * velocity, dz / distance * velocity, this.nav, tick);
  }
  private seek(e: EntitySnapshot, target: { x: number; z: number }): void {
    const grid = this.navigation.district(e.transform), b = e.infected!;
    if (b.pathGrid !== grid) { b.pathGrid = grid; b.goal = -1; b.path.length = 0; }
    const nav = this.navigation.grid(e.transform); target = this.navigation.target(e.transform, target);
    let x = target.x, z = target.z;
    const from = nav.nearestCell(e.transform.x, e.transform.z), to = nav.nearestCell(x, z);
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
    const speed = Math.min(b.speed, remaining * 2); moveAgent(e, dx / distance * speed, dz / distance * speed, this.nav, this.world.tick);
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
