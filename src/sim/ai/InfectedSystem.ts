import { l3BaseCollision } from '../../levels/L3/collision';
import { dogModel } from '../../data/dogAppearance';
import { cureAlphaPopulation, cureAlphaCap, cureRegularAlphaCount, type CureRegion } from '../../levels/L10/alphaContracts';
import { megaAlpha } from '../../data/megaAlpha';
import { balancedCrowdModel, regularInfectedModels } from '../../data/crowdAppearance';
import { isCorgi, isCorgiModel, storyProtected } from '../npc/storyProtection';
import { installAgentMotion, moveAgent } from '../locomotion/AgentMotion';
import { motionResponse, resetResponse } from '../locomotion/MotionResponse';
import { infectedContactDistance, installCharacterSeparation } from './CharacterSeparation';
import { noise } from '../../data/noise';
// Zone enter/alert pattern adapted from Bruno Simon folio-2025 Zones.js (MIT, 41046b5).
import { INFECTED_TOUGHNESS, infectedSpecialMoves, infectedSpecialRecoveryTicks, type InfectedSpecialMove, infectedDef, infectedRecovery, l1ReactionS, l1SpeedTier, l1TierSpeed, validateInfected, type InfectedSpeedTier } from '../../data/infected';
import { l1v2 } from '../../data/l1v2';
import { l3 } from '../../data/l3';
import { isOutbreakDistrict } from '../../levels/districts/types';
import type { DistractionEvent, HumanTarget, HumanTargetQuery } from '../outbreak/types';
import { Perception, WorldHumans } from './Perception';
import { planSearch, searchPlan, wanderGoal, type L1Brain } from './Search';
import { Rng } from '../../core/Rng';
import { Status } from '../combat/Status';
import type { SimWorld } from '../world/SimWorld';
import type { EntitySnapshot } from '../world/types';
import type { ScenarioDefinition } from '../../levels/loader';
import { DistrictNavigation } from './DistrictNavigation';
import { AlphaSupportMoves } from './AlphaSupportMoves';
import { PropThrows } from './PropThrows';
import { steerFlockDive, updateFlock } from './Flock';
import { SpawnDirector } from './SpawnDirector';
import { NavGrid } from './NavGrid';
import type { InfectedState } from './types';
export interface InfectedSpawn { cureRegion?: CureRegion; state?: InfectedState['state']; yaw?: number; variant?: string; pack?: number; packIndex?: number; perched?: boolean; birds?: number; /** L1 v2 speed tier; derived from the variant when omitted. */ tier?: InfectedSpeedTier; /** E32 Mega Alpha introduced in a non-resident region (no loaded nav to validate against). */ offNav?: boolean }
const l1Ticks = (seconds: number) => Math.round(seconds * 60);
const hearingReactionTicks = 15, hearingTurnRadS = 14;
/** Fixed-step infected brain. Entities and path storage are prewarmed and reused, without Rapier bodies. */
export class InfectedSystem {
  gore: 'Full' | 'Reduced' | 'Off' = 'Full';
  navigation: DistrictNavigation;
  readonly props: PropThrows;
  readonly alphaSupport: AlphaSupportMoves;
  readonly director: SpawnDirector;
  nav: NavGrid;
  private admissionNav?: NavGrid;
  /** Infected steering, separation and impulses share this collision registry. Humans retain `nav`. */
  get infectedNav(): NavGrid { return this.admissionNav ?? this.nav; }
  excludeInfected(walls: readonly import('../combat/HitQuery').CoverWall[]): void {
    const n = this.nav;
    this.admissionNav = n.withClearance(n.clearance);
    for (const [i, wall] of walls.entries()) this.admissionNav.setBlocker(910_300 + i, wall, true);
    this.navigation = new DistrictNavigation({ name: 'infected-admission', ground: n.ground, player: this.world.entities.get(1)!.transform, walls: [...n.walls, ...walls], navigation: this.navigation.districts.map(d => d.definition) }, this.admissionNav);
  }
  readonly rng: Rng;
  readonly active: EntitySnapshot[] = [];
  readonly pool: EntitySnapshot[] = [];
  readonly counters = { allocated: 0, reused: 0, released: 0 };
  readonly perches: NonNullable<ScenarioDefinition['perches']>;
  readonly crowd: { transform: EntitySnapshot['transform']; radius: number }[] = [];
  private readonly neighbors: number[] = [];
  private readonly physicalNeighbors: number[] = [];
  private readonly physicalQuery = { x: 0, z: 0, r: 4 };
  private readonly physicalDirection = { x: 0, z: 0 };
  private readonly physicalOrigin = { x: 0, z: 0 };
  private readonly barricades: EntitySnapshot[] = [];
  private readonly query = { x: 0, z: 0, r: 2 };
  /** E08 calls this for adjacent adult civilians; its rescue/turning lifecycle remains in E08. */
  tryGrabCivilian(sourceId: number, target: { id: number; adult: boolean; variant: string; position: { x: number; z: number } }): { sourceId: number; rescueUntil: number } | null {
    if (this.l1) return null; // L1 v2 bites come from the infected brain (BiteEvent), not from civilian proximity rolls.
    const source = this.world.entities.get(sourceId);
    if (source?.archetype === 'infected.alpha' && this.world.entities.get(target.id)?.civilian?.ally?.role === 'soldier') return null;
    if (!target.adult || !source?.infected || source.health.current <= 0 || Math.hypot(source.transform.x - target.position.x, source.transform.z - target.position.z) > 1.2 || this.rng.next() >= infectedDef(source.archetype).grabChance) return null;
    this.world.events.emit({ type: 'civilian.grabbed', tick: this.world.tick, sourceId, targetId: target.id, variant: target.variant, rescueUntil: this.world.tick + 90 });
    return { sourceId, rescueUntil: this.world.tick + 90 };
  }
  /** Risen civilians retain their mapped clothes; a capped rise stays queued. Only adults may turn. */
  turnCivilian(target: { adult: boolean; variant: string; archetype: string; position: { x: number; z: number } }): void {
    if (!target.adult) return;
    this.director.requestTurn(target.archetype, target.position, target.variant);
  }
  readonly hearing: Perception;
  private sequence = 0;
  private l3HumanSpawns = 0;
  private budget = 0;
  private routes = 0;
  private readonly forecourtPursuers = new Set<number>();
  private forecourt: { x: number; z: number } | null = null;
  private readonly lureTarget = { x: 0, z: 0 };
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld, definition: ScenarioDefinition, mask: NavGrid['mask'] = null) {
    this.hearing = new Perception(world);
    this.perches = definition.perches ?? [];
    installCharacterSeparation(world); installAgentMotion(world);
    validateInfected(); this.rng = new Rng(world.seed, 'infected'); this.nav = new NavGrid(definition.ground, definition.walls ?? [], definition.navigationClearance ?? 0.65, definition.ground.center, mask); this.navigation = new DistrictNavigation(definition, this.infectedNav); if (world.scenario === 'L3') this.excludeInfected(l3BaseCollision); this.director = new SpawnDirector(this); if (world.scenario === 'L10') this.director.strict = true; this.props = new PropThrows(world); this.alphaSupport = new AlphaSupportMoves(this);
    for (let i = 0; i < 350; i++) {
      const brain: InfectedState = { state: 'idle', pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: 0, until: 0, cooldown: 0, attackId: 0, special: '', hidden: false, deadAt: -1, recoverAt: -1, downs: 0, revived: false, reviveUsed: false, legLost: false, detached: false, pack: 0, packIndex: 0, birds: 0, birdPositions: new Array(60).fill(0), birdAlive: new Array(20).fill(0), scatterUntil: 0, variant: '', path: [], pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: false };
      this.pool.push({ id: 0, kind: 'infected', archetype: '', faction: 'infected', health: { current: 0, max: 0 }, transform: { x: 0, y: 0.7, z: 0, yaw: 0 }, infected: brain, combat: { radius: 0.35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }); this.counters.allocated++;
    }
    for (const [id, wall] of world.props?.navWalls ?? []) {
      this.nav.setBlocker(id, wall, true); this.admissionNav?.setBlocker(id, wall, true);
      for (const d of this.navigation.districts) d.grid.setBlocker(id, wall, true);
    }
    for (const wall of world.interactables?.walls ?? []) if (wall.entityId !== undefined) { this.nav.setBlocker(wall.entityId, wall, true); this.admissionNav?.setBlocker(wall.entityId, wall, true); for (const d of this.navigation.districts) d.grid.setBlocker(wall.entityId, wall, true); }
    world.events.on('world.blocker.changed', (event) => {
      if (event.type !== 'world.blocker.changed') return;
      this.nav.setBlocker(event.id, event.wall, event.blocked);
      this.admissionNav?.setBlocker(event.id, event.wall, event.blocked);
      for (const district of this.navigation.districts) district.grid.setBlocker(event.id, event.wall, event.blocked);
      for (const entity of this.active) { entity.infected!.goal = -1; entity.infected!.path.length = 0; if (entity.infected!.l1) entity.infected!.l1.directTick = -1; delete entity.infected!.birdMotion; delete entity.infected!.birdVertical; }
    });
    world.events.on('noise', (event) => { if (event.type === 'noise') this.noise(event.position, event.radius, event.radius >= 25, event.sourceId); });
    world.events.on('outbreak.distraction', (event) => { if (event.type === 'outbreak.distraction') this.distraction(event); });
    if (world.districts?.districts.some((d) => isOutbreakDistrict(d.id))) this.configureL1v2();
    world.events.on('combat.hit', (event) => {
      if (event.type !== 'combat.hit' || event.amount <= 0) return;
      const target = world.entities.get(event.targetId);
      if (target?.infected) {
        target.infected.grabHits++;
        if (target.infected.special === 'pin' && target.infected.grabHits >= 2) this.releasePin(target);
      }
    });
    world.events.on('combat.attack', (event) => {
      if (event.type !== 'combat.attack' || event.sourceId !== 1) return;
      for (const e of this.active) if (e.infected!.grabUntil > world.tick) {
        if (e.infected!.special === 'cling') e.infected!.grabUntil = 0;
        else if (e.infected!.special === 'pin' && ++e.infected!.grabHits >= 2) this.releasePin(e);
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
    const l3Human = this.world.scenario === 'L3' && (id === 'infected.runner' || id === 'infected.sprinter');
    // Count successful emergences, including turned officers and civilians. Clothes do not determine chase speed.
    if (l3Human) id = (this.l3HumanSpawns + 1) % l3.infected.sprinterEvery === 0 ? 'infected.sprinter' : 'infected.runner';
    // E32-AC08: no spawn may stand in for, or be drawn as, the player's corgi.
    if (isCorgiModel(id) || isCorgiModel(opts.variant)) throw new RangeError('The corgi is never an infected spawn');
    const def = infectedDef(id);
    if (id === 'infected.alpha' && opts.variant !== megaAlpha.asset && (this.world.scenario === 'L10' || opts.cureRegion)) {
      if (!opts.cureRegion) throw new RangeError('L10 regular Alpha requires an authored cure region');
      if (cureRegularAlphaCount(cureAlphaPopulation(this.world), opts.cureRegion) >= cureAlphaCap(opts.cureRegion, this.director.tier)) throw new Error('L10 regular Alpha region cap reached');
    }
    const perch = this.perchFor(id, position, opts.perched);
    if (perch) position = perch;
    if (opts.yaw !== undefined && !Number.isFinite(opts.yaw)) throw new RangeError('Invalid infected facing');
    if (id === 'infected.crow' && opts.birds !== undefined && (!Number.isInteger(opts.birds) || opts.birds < 1 || opts.birds > 20)) throw new RangeError('A flock contains 1–20 birds');
    const weight = id === 'infected.crow' ? (opts.birds ?? 20) * 0.25 : 1;
    if (this.director.count + weight > this.director.cap) throw new Error('Infected concurrency cap reached');
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || (!opts.offNav && this.nav.cell(position.x, position.z) < 0)) throw new RangeError('Infected spawn inside collider or outside grid');
    const entity = this.pool.pop(); if (!entity) throw new Error('Infected pool exhausted');
    if (l3Human) this.l3HumanSpawns++;
    entity.locomotion = motionResponse(); delete entity.motion;
    delete entity.infected!.investigate; delete entity.infected!.model; delete entity.infected!.birdDeadMask; delete entity.infectionRise; delete entity.appearance; delete entity.noiseTarget; delete entity.attachedTo; delete entity.hidden; delete entity.corpse;
    delete entity.infected!.roar; delete entity.corpseThrown; delete entity.infected!.pursuit; delete entity.infected!.megaStaggerReady; delete entity.infected!.megaRocketIds;
    delete entity.infected!.cureRegion; delete entity.infected!.territory; delete entity.infected!.vault; delete entity.infected!.specialAttack; delete entity.infected!.specialCooldowns; delete entity.infected!.specialRecoveryUntil;
    entity.archetype = id; entity.health.current = entity.health.max = def.hp * INFECTED_TOUGHNESS;
    Object.assign(entity.transform, position); entity.transform.y = perch?.y ?? .7 + (this.world.districts?.pavingHeight(position.x, position.z) ?? 0); entity.transform.yaw = opts.yaw ?? 0;
    Object.assign(entity.combat!, { radius: def.radius, armor: 0, shield: def.special === 'shield', staggerUntil: 0, attacking: false, damageMultiplier: 1 }); entity.combat!.statuses.length = 0; delete entity.combat!.reaction;
    Object.assign(entity.infected!, { state: opts.state ?? 'idle', heardTargetId: 0, pathGrid: -1, grabNextTick: 0, combo: 0, targetId: 0, activeUntil: 0, speed: def.speed, until: 0, cooldown: 0, attackId: 0, special: def.special, hidden: id === 'infected.cat', deadAt: -1, recoverAt: -1, downs: 0, revived: false, reviveUsed: false, legLost: false, detached: false, pack: opts.pack ?? 0, packIndex: opts.packIndex ?? 0, birds: id === 'infected.crow' ? opts.birds ?? 20 : 0, scatterUntil: 0, variant: opts.variant ?? id, pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: opts.perched ?? id === 'infected.cat' }); entity.infected!.path.length = 0; if (entity.infected!.l1) entity.infected!.l1.directTick = -1; delete entity.infected!.birdMotion; delete entity.infected!.birdVertical;
    for (let bird = 0; bird < 20; bird++) { entity.infected!.birdAlive[bird] = Number(bird < entity.infected!.birds); entity.infected!.birdPositions[bird * 3] = position.x + Math.cos(bird * 2.399963) * 2; entity.infected!.birdPositions[bird * 3 + 1] = 3; entity.infected!.birdPositions[bird * 3 + 2] = position.z + Math.sin(bird * 2.399963) * 2; }
    if (id === 'infected.crow') entity.health.current = entity.health.max = entity.infected!.birds * INFECTED_TOUGHNESS;
    if (this.l1 && def.special === 'lunge') this.initL1(entity, opts.tier ?? l1SpeedTier(entity.infected!.variant)); else delete entity.infected!.l1;
    this.world.entities.adopt(entity);
    if (opts.cureRegion) entity.infected!.cureRegion = opts.cureRegion;
    if (id === 'infected.dog' && !opts.variant) entity.infected!.variant = dogModel(this.world.seed, entity.id, true);
    if (!opts.variant && (id === 'infected.runner' || id === 'infected.sprinter')) {
      entity.infected!.variant = balancedCrowdModel(regularInfectedModels,
        this.active.filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden).map(e => ({ model: e.infected!.model ?? e.infected!.variant, x: e.transform.x, z: e.transform.z })), position, entity.id);
    }
    this.active.push(entity); this.world.spatial.set(entity.id, position.x, position.z); this.counters.reused++;
    this.world.solids.admit(entity, 'infected.spawn', 4, !opts.offNav);
    return entity.id;
  }
  release(entity: EntitySnapshot): void {
    const index = this.active.indexOf(entity); if (index < 0) return;
    this.active.splice(index, 1); this.world.entities.delete(entity.id); this.world.spatial.delete(entity.id); this.pool.push(entity); this.counters.released++;
  }
  /** Keep the existing frozen death figure while returning its simulated slot to the replenishment pool. */
  settle(entity: EntitySnapshot): void {
    // A recoverable body still owns a live timer and its concurrency slot.
    if (entity.infected!.recoverAt >= 0) return;
    const body = structuredClone({ ...entity, locomotion: undefined, motion: undefined, combat: { ...entity.combat!, reaction: undefined }, infected: { ...entity.infected!, l1: undefined, path: [], recoverAt: -1 } }); body.corpse = true;
    delete body.locomotion; delete body.motion; delete body.combat!.reaction;
    delete body.infected!.l1; body.infected!.path.length = 0;
    this.release(entity); this.world.entities.replace(body);
  }
  /** Hearing ignores facing; sight uses a 110° cone and collider line of sight. */
  noise(position: { x: number; z: number }, radius: number, loud = false, sourceId?: number): void {
    if (this.l1 && !l1v2.infected.hearsPlayer) return; // Long-range player noise stays unchanged; close hearing is queried separately.
    for (const e of this.active) if (e.health.current > 0 && Math.hypot(e.transform.x - position.x, e.transform.z - position.z) <= radius) {
      if (sourceId !== undefined && this.world.combat?.effects.inSmoke(e.transform)) continue;
      if (sourceId !== undefined && (e.infected!.state === 'idle' || e.infected!.state === 'wander')) this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, sourceId, targetId: e.id, cause: 'noise', position: { ...e.transform } });
      if (loud && e.archetype === 'infected.crow') { e.infected!.state = 'scatter'; e.infected!.scatterUntil = this.world.tick + 300; }
      else this.alert(e);
    }
  }
  alert(entity: EntitySnapshot): void { if (entity.infected!.state === 'idle' || entity.infected!.state === 'wander') { entity.infected!.state = 'alerted'; entity.infected!.until = this.world.tick + 6; } }
  update(): void {
    if (this.world.progression?.campaign?.world?.infectionCleared && this.world.scenario !== 'L10' && this.world.missions?.state.id !== 'L10') for (const e of this.active) this.world.combat?.damage.cure(e);
    const courier = this.world.entities.get(1)!; this.budget = 2000; this.routes = 0; this.director.update();
    this.prepareForecourt(courier.transform);
    this.barricades.length = 0; for (const e of this.world.entities.iterate()) if (e.kind === 'barricade' && e.health.current > 0) this.barricades.push(e);
    if (this.active.length > 20) this.navigation.flow(courier.transform, 1500);
    this.crowd.length = 0;
    for (const e of this.active) {
      if (e.pendingAdmission && e.health.current > 0) continue;
      this.world.solids.wrote(e, 'infected.update');
      if (this.world.npcs?.civilians.holds(e.id)) { e.combat!.attacking = false; continue; }
      const b = e.infected!; if (e.health.current <= 0) { this.dead(e); continue; }
      if (e.infectionRise && this.world.tick < e.infectionRise.until) { e.combat!.attacking = false; continue; }
      if (e.attachedTo !== undefined) { e.combat!.attacking = false; continue; }
      if (this.world.missions?.state.states['cure-released']) {
        this.cancelSpecial(e.id); if (b.special === 'pin') this.releasePin(e);
        e.combat!.attacking = false; b.grabUntil = 0; b.state = 'chase';
        this.seek(e, courier.transform); this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
      // E32 Mega Alpha: global pursuit owns its movement; close range and recovery hand the tick to the Alpha brain below.
      if (b.pursuit && this.world.megaPursuit?.drive(e)) continue;
      if (this.world.barricades?.vault(e)) continue;
      // E18: far L3 crowds keep swept motion every tick, with decision work spread over six stable slots.
      // Nearby humans, reactions and the rescue fight retain the full-rate brain.
      if (this.world.scenario === 'L3' && !this.world.missions?.state.l3?.finaleAt && b.l1 && e.locomotion && !b.specialAttack && !e.emerging &&
          this.world.tick % 6 !== e.id % 6 && Math.hypot(e.transform.x-courier.transform.x,e.transform.z-courier.transform.z)>35 &&
          (!e.combat?.reaction || this.world.tick >= e.combat.reaction.until) && this.director.offscreen(e.transform,e.transform.y-.7) &&
          this.hearing.humans.within(e.transform,18).length===0) {
        if (!b.l1.looking) moveAgent(e,e.locomotion.vx,e.locomotion.vz,this.infectedNav,this.world.tick,e.combat!.radius,true);
        e.transform.y=(this.world.districts?.groundHeight(e.transform.x,e.transform.z)??0)+.7;
        this.world.spatial.set(e.id,e.transform.x,e.transform.z); continue;
      }
      if (!b.specialAttack && (this.world.tick + e.id) % 3 === 0 && !e.emerging && !b.perched && !b.hidden && b.grabUntil <= this.world.tick) this.depenetrate(e);
      if (b.scripted && !b.specialAttack) {
        if (!Status.stunned(e, this.world.tick) && Math.hypot(e.transform.x - b.scripted.x, e.transform.z - b.scripted.z) > .6) this.seek(e, b.scripted);
        e.combat!.attacking = false; this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
      if ((this.world.scenario === 'L4' || this.world.scenario === 'L5') && e.archetype === 'infected.alpha' && !b.specialAttack && !b.pursuit) {
        const seen = this.hearing.closest(e, b.heardTargetId ?? 0);
        if (seen) {
          delete b.investigate; b.heardTargetId = seen.id;
          if (b.state === 'attracted') b.state = 'idle';
          if (b.state === 'idle' || b.state === 'wander') { this.alert(e); this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, sourceId: seen.id, targetId: e.id, cause: 'sight', position: { ...e.transform } }); }
        } else {
          b.heardTargetId = 0; e.combat!.attacking = false;
          if (b.investigate && this.world.tick < b.until) {
            if (!Status.stunned(e, this.world.tick) && Math.hypot(e.transform.x - b.investigate.x, e.transform.z - b.investigate.z) > 1.5) this.seek(e, b.investigate);
            this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
          }
          delete b.investigate; b.state = 'idle';
        }
      }
      const territory = b.territory;
      if (territory) {
        const target = b.specialAttack?.target ?? b.investigate ?? (b.heardTargetId ? this.world.entities.get(b.heardTargetId)?.transform : undefined);
        if (target && Math.hypot(target.x - territory.x, target.z - territory.z) > territory.radius) {
          this.cancelSpecial(e.id); delete b.investigate; b.heardTargetId = 0; b.state = 'idle'; e.combat!.attacking = false;
          if (!Status.stunned(e, this.world.tick) && Math.hypot(e.transform.x - territory.x, e.transform.z - territory.z) > 1) this.seek(e, territory);
          this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
        }
      }
      if (this.updateSpecial(e)) continue;
      if (b.roar) {
        const roar = b.roar;
        if (this.world.tick >= roar.until) {
          this.world.events.emit({ type: 'infected.roar-buff', tick: this.world.tick, sourceId: roar.sourceId, targetId: e.id, attackId: roar.attackId, stage: 'expiry', until: roar.until });
          delete b.roar; b.path.length = 0; b.goal = -1;
        } else if (!Status.stunned(e, this.world.tick)) {
          e.combat!.attacking = false;
          if (b.l1) this.steerL1(e, b.l1, roar, b.l1.runSpeed * (roar.speedUntil === undefined || this.world.tick < roar.speedUntil ? roar.speedScale ?? 1.25 : 1));
          else this.seek(e, roar);
          this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
        }
      }
      if (b.special === 'pin' && b.grabHits >= 2) this.releasePin(e);
      if (b.special === 'pin' && b.grabUntil > this.world.tick) {
        const held = this.world.entities.get(b.heardTargetId || 1);
        if (!held || held.health.current <= 0 || held.hidden || this.world.inspectionGhost) this.releasePin(e);
        else { e.combat!.attacking = false; continue; }
      }
      if (b.l1) { this.updateL1(e, b, b.l1); continue; }
      if (b.heardTargetId && !this.hearing.humans.get(b.heardTargetId)) { b.heardTargetId = 0; b.grabUntil = 0; b.state = 'idle'; e.combat!.attacking = false; }
      const player = this.victim(e);
      if ((b.state === 'idle' || b.state === 'wander') && !Status.stunned(e, this.world.tick) && !e.emerging) {
        const heard = this.hearing.closestHeard(e);
        if (heard && !(heard.id === 1 && this.seesPlayer(e, player))) {
          b.heardTargetId = heard.id; b.state = 'alerted'; b.until = this.world.tick + hearingReactionTicks;
          this.world.events.emit({ type: 'ai.alerted', tick: this.world.tick, sourceId: heard.id, targetId: e.id, cause: 'hearing', position: { ...e.transform } });
        }
      }
      if (this.world.inspectionGhost && b.targetId <= 1 && !['idle', 'wander', 'migration'].includes(b.state)) {
        b.state = 'idle'; b.grabUntil = 0; e.combat!.attacking = false;
      }
      const lure = e.noiseTarget && this.world.tick < e.noiseTarget.until ? this.world.entities.get(e.noiseTarget.id) : undefined;
      if (lure && b.state !== 'migration' && !Status.stunned(e, this.world.tick)) {
        b.state = 'chase'; e.combat!.attacking = false;
        const dx = e.transform.x - lure.transform.x, dz = e.transform.z - lure.transform.z, distance = Math.hypot(dx, dz);
        const stop = (lure.combat?.radius ?? .6) + this.infectedNav.clearance + this.infectedNav.cellSize;
        if (distance > stop + .5) {
          this.lureTarget.x = lure.transform.x + dx / distance * stop; this.lureTarget.z = lure.transform.z + dz / distance * stop;
          this.seek(e, this.lureTarget);
        }
        this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
      if (b.grabUntil > this.world.tick && ((b.special === 'grab' && b.grabHits >= 3) || (b.special === 'cling' && Math.hypot(player.transform.x - b.grabX, player.transform.z - b.grabZ) >= 3))) b.grabUntil = 0;
      if (b.special === 'dive' && !this.world.inspectionGhost) {
        updateFlock(e, this.world.tick, player.transform);
        if (this.world.tick < b.scatterUntil) { b.state = 'scatter'; continue; }
        if (b.state === 'scatter') b.state = 'chase';
      }
      const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
      if (b.special === 'cling' && b.hidden) {
        if (distance > 5 || this.world.inspectionGhost) continue;
        b.hidden = false; b.perched = false; if (!b.heardTargetId) b.state = 'chase'; e.transform.y = 0.7;
      }
      if (b.grabUntil > this.world.tick && b.special === 'cling') {
        if (this.world.tick >= b.grabNextTick) { this.attackVictim(e, 3); b.grabNextTick += 60; }
        e.transform.x = player.transform.x; e.transform.y = player.transform.y + 0.3; e.transform.z = player.transform.z; this.world.spatial.set(e.id, e.transform.x, e.transform.z); continue;
      }
      if (b.state === 'idle' || b.state === 'wander') {
        if (!this.world.inspectionGhost && this.seesPlayer(e, player)) this.alert(e);
        if (b.state === 'wander') {
          moveAgent(e, b.dx * b.speed / 2, b.dz * b.speed / 2, this.infectedNav, this.world.tick); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
          if (this.world.tick >= b.until) b.state = 'idle';
        } else if (this.world.tick >= 240 && this.world.tick % 240 === e.id % 240) { b.state = 'wander'; b.until = this.world.tick + 120; const angle = this.rng.next() * Math.PI * 2; b.dx = Math.cos(angle); b.dz = Math.sin(angle); }
        continue;
      }
      if (b.state === 'migration') continue;
      if (b.state === 'alerted') {
        if (b.heardTargetId) {
          const target = this.victim(e).transform, yaw = -Math.atan2(target.z - e.transform.z, target.x - e.transform.x);
          const delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
          e.transform.yaw += Math.max(-hearingTurnRadS / 60, Math.min(hearingTurnRadS / 60, delta));
        }
        if (this.world.tick >= b.until) b.state = 'chase'; else continue;
      }
      if (Status.stunned(e, this.world.tick)) { b.state = 'stagger'; continue; }
      if (b.state === 'stagger') b.state = 'chase';
      if (b.state === 'attack') {
        if (this.world.tick >= b.until && this.resolve(e)) {
          if (b.special === 'combo-grab' && b.combo < 2) { b.combo++; this.windup(e); continue; }
          const def = infectedDef(e.archetype);
          b.state = 'chase';
          b.cooldown = this.world.tick + (def.attackInterval === undefined ? b.special === 'scream' ? 300 : 60 : Math.round((def.attackInterval - def.windup) * 60));
          e.combat!.attacking = false;
        }
        continue;
      }
      // E27-AC08: smoke on the sight line (or around the infected) breaks the chase; it wanders until sight returns.
      if (b.state === 'chase' && !b.pursuit && this.world.combat?.effects.smokeBlocks(e.transform, player.transform)) {
        b.state = 'wander'; b.until = this.world.tick + 90; e.combat!.attacking = false;
        const angle = this.rng.next() * Math.PI * 2; b.dx = Math.cos(angle); b.dz = Math.sin(angle);
        this.world.events.emit({ type: 'ai.lostTarget', tick: this.world.tick, sourceId: e.id, targetId: player.id, cause: 'smoke' });
        continue;
      }
      if (b.state === 'chase') {
        if (!this.world.inspectionGhost && (this.alphaSupport.tryStart(e, player) || this.tryZooSpecial(e, player))) continue;
        if (e.archetype === 'infected.alpha' && !this.world.inspectionGhost && this.world.tick >= b.cooldown && this.world.tick >= (b.specialRecoveryUntil ?? 0)) {
          const move = b.pursuit && distance <= 2 ? 'alpha.grab-throw' : distance <= 4 ? 'alpha.ground-slam' : distance <= 12 ? 'alpha.charge' : undefined;
          if (move && this.world.tick + infectedSpecialMoves[move].windup >= (b.specialCooldowns?.[move] ?? 0) && this.world.combat!.query.visible(e.transform, player.transform) && this.startSpecial(e.id, move, { id: player.id, x: player.transform.x, z: player.transform.z }, { x: e.transform.x, z: e.transform.z, radius: move === 'alpha.charge' ? 1 : 4, dx: dx / Math.max(.001, distance), dz: dz / Math.max(.001, distance) })) continue;
        }
        let obstacle = this.world.barricades?.attackTarget(e, player.transform);
        for (const target of this.barricades) if (!obstacle && !target.barricade && target.health.current > 0 && Math.hypot(e.transform.x - target.transform.x, e.transform.z - target.transform.z) <= 2) { obstacle = target; break; }
        // Hold at an obstructing brace during cooldown. Seeking an unreachable goal here
        // makes the nearest-cell fallback pull attackers away between their hits.
        if (obstacle) {
          if (this.world.barricades!.vault(e, obstacle)) continue;
          if (!this.world.barricades!.withinReach(e, obstacle)) { this.seek(e, this.world.barricades!.approach(e, obstacle)); this.world.spatial.set(e.id, e.transform.x, e.transform.z); }
          else if (this.world.tick >= b.cooldown) { this.windup(e); b.targetId = obstacle.id; }
          continue;
        }
        let range = this.strikeRange(e, player);
        if (b.special === 'lunge') range = 2.5;
        if (b.special === 'aura') range = 3;
        if (b.special === 'charge') range = 8;
        if (b.special === 'pin' && e.archetype !== 'infected.lion') range = 10;
        if (b.special === 'cling') range = 6;
        if (b.special === 'pounce') range = 4;
        if (b.special === 'dive') range = 6;
        if (b.special === 'scream') range = 20;
        if (b.special === 'revive' && this.revivable(e)) range = 20;
        const packAngle = b.packIndex * Math.PI / 2;
        const packReady = !b.pack || b.special !== 'pounce' || (-dx * Math.cos(packAngle) - dz * Math.sin(packAngle)) / Math.max(0.01, distance) >= 0.85;
        if (packReady && distance <= range && this.world.tick >= b.cooldown && this.world.combat!.query.visible(e.transform, player.transform)) { b.combo = 0; this.windup(e); continue; }
        if (b.special === 'pounce' && b.pack && (!packReady || distance > 4)) {
          const angle = b.packIndex * Math.PI / 2; this.waypoint.x = player.transform.x + Math.cos(angle) * 3; this.waypoint.z = player.transform.z + Math.sin(angle) * 3;
          this.seek(e, this.waypoint);
        } else this.seek(e, player.transform); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      }
    }
    // Once the death/explosion animation settles, keep a static identity record
    // and return the costly brain to the warm pool. Bodies live until level unload.
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      if (e.health.current > 0 || e.infected!.recoverAt >= 0 || this.world.tick - e.infected!.deadAt < 120) continue;
      this.settle(e);
    }
    // The player consumes borrowed transform references, never renderer state.
    for (const e of this.active) if (e.health.current > 0) this.crowd.push(this.obstacle(e));
    if (this.world.player) this.world.player.locomotion.crowd = this.crowd;
  }
  /**
   * A body inside a collider or nav blocker (a parked truck's footprint switched on around it, a closed gate) can never move:
   * every swept step starts blocked. Walk it out toward the nearest free spot (up to 3 m, ~4 m/s), ignoring the solid it
   * is already in (every swept step from a not-clear spot fails, however shallow).
   */
  private depenetrate(e: EntitySnapshot): void {
    const t = e.transform, r = e.combat!.radius, nav = this.infectedNav;
    if (nav.clear(t.x, t.z, r - 0.001)) return;
    for (let d = 0.25; d <= 3; d += 0.25) for (let k = 0; k < 16; k++) {
      const a = (k + (e.id % 16) * 0.5) * Math.PI / 8, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!nav.clear(x, z, r)) continue;
      const step = Math.min(d, 12 / 60); // every third tick: ~4 m/s
      t.x += Math.cos(a) * step; t.z += Math.sin(a) * step; this.world.spatial.set(e.id, t.x, t.z);
      if (e.infected!.l1) { e.infected!.l1.directTick = -1; e.infected!.path.length = 0; }
      return;
    }
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
      if (e.health.current > 0 && (b.heardTargetId ?? 0) <= 1 && b.grabUntil > this.world.tick && (b.special === 'grab' || b.special === 'cling' || b.special === 'combo-grab')) return 0.5;
    }
    return 1;
  }
  private releasePin(source: EntitySnapshot): void {
    const b = source.infected!, target = this.world.entities.get(b.heardTargetId || 1), until = b.grabUntil;
    b.grabUntil = 0;
    if (source.archetype !== 'infected.lion' || until <= this.world.tick || !target) return;
    if (target.civilian?.knockedUntil === until) target.civilian.knockedUntil = this.world.tick;
    if (target.escort?.knockedUntil === until) target.escort.knockedUntil = this.world.tick;
    if (target.combat?.staggerUntil === until) target.combat.staggerUntil = this.world.tick;
    if (target.combat?.reaction?.until === until) delete target.combat.reaction;
  }
  playerPinned(): boolean {
    for (const e of this.active) {
      const b = e.infected!;
      if (e.health.current > 0 && (b.heardTargetId ?? 0) <= 1 && b.grabUntil > this.world.tick && (b.special === 'pounce' || b.special === 'pin')) return true;
    }
    return false;
  }
  /** Existing archetype vision: 110 degrees / 14 m, weather, light and smoke unchanged. */
  private seesPlayer(e: EntitySnapshot, player: EntitySnapshot): boolean {
    const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
    return distance <= 14 * (this.world.weather?.modifiers.infectedSight ?? 1) * (this.world.lightPower?.sightMultiplier(player.transform) ?? 1)
      && (distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= Math.cos(55 * Math.PI / 180))
      && this.world.combat!.query.visible(e.transform, player.transform) && !this.world.combat!.effects.smokeBlocks(e.transform, player.transform);
  }
  private victim(e: EntitySnapshot): EntitySnapshot {
    const target = this.world.entities.get(e.infected!.heardTargetId || 1);
    return target && !isCorgi(target) ? target : this.world.entities.get(1)!;
  }
  private windup(e: EntitySnapshot): void {
    const b = e.infected!, def = infectedDef(e.archetype); b.state = 'attack'; b.attackId = this.nextAttackId();
    b.until = this.world.tick + Math.ceil(def.windup * 60); e.combat!.attacking = true;
    // A runner's lunge is a short homing burst (0.33 s, ~2.3 m): it strikes a courier who stands or turns into it, a courier
    // running flat out escapes it (E19-AC14 evade battery). Charges, pounces and leaps keep their 2 s committed line.
    b.activeUntil = b.until + (b.special === 'lunge' ? 20 : 120);
    const player = this.victim(e); const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
    b.dx = distance ? dx / distance : 1; b.dz = distance ? dz / distance : 0;
    if (distance > .001) e.transform.yaw = -Math.atan2(dz, dx);
    this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: b.special, duration: def.windup });
  }
  private revivable(e: EntitySnapshot): EntitySnapshot | undefined {
    for (const other of this.world.entities.iterate()) if (other.archetype === 'infected.runner' && other.health.current <= 0 && !other.infected!.revived && this.world.tick - other.infected!.deadAt <= 2700 && Math.hypot(e.transform.x - other.transform.x, e.transform.z - other.transform.z) <= 6) return other;
    return undefined;
  }
  /** Match strike reach to the larger attacker's body without extending the ordinary runner's reach. */
  private strikeRange(e: EntitySnapshot, target: EntitySnapshot): number {
    return infectedDef(e.archetype).range + (target.survivor ? Math.max(0, e.combat!.radius - .35) : 0);
  }
  private resolve(e: EntitySnapshot): boolean {
    const b = e.infected!, player = this.victim(e), def = infectedDef(e.archetype);
    if (b.targetId) {
      const target = this.world.entities.get(b.targetId); b.targetId = 0;
      if (target && target.health.current > 0 && (target.barricade || target.kind === 'physics-prop' ? this.world.barricades!.withinReach(e, target) : Math.hypot(e.transform.x - target.transform.x, e.transform.z - target.transform.z) <= 2)) {
        const amount = this.world.combat!.damage.apply({ sourceId: e.id, targetId: target.id, attackId: b.attackId, actionId: e.archetype, origin: e.transform, direction: { x: 0, z: 0 }, base: this.barricadeDamage(e.id, def.damage), multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, targetId: target.id, attackId: b.attackId, special: 'barricade', amount });
      }
      return true;
    }
    if (b.special === 'scream') { this.world.events.emit({ type: 'noise', tick: this.world.tick, sourceId: e.id, actionId: e.archetype, position: { ...e.transform }, ...noise.scream, kind: 'scream' }); return true; }
    if (b.special === 'revive' && !b.reviveUsed) {
      let downed = this.revivable(e);
      if (downed && this.director.count + 1 <= this.director.cap && (!downed.corpse || this.pool.length)) {
        if (downed.corpse) {
          const record = this.pool.pop()!;
          Object.assign(record, structuredClone(downed)); delete record.corpse;
          record.locomotion = motionResponse(); delete record.motion;
          this.world.entities.replace(record); this.active.push(record); this.counters.reused++;
          this.world.spatial.set(record.id, record.transform.x, record.transform.z); downed = record;
        }
        downed.health.current = downed.health.max; downed.infected!.recoverAt = -1; downed.infected!.revived = true; downed.infected!.deadAt = -1; downed.infected!.state = 'chase'; b.reviveUsed = true; this.world.events.emit({ type: 'infected.revived', tick: this.world.tick, sourceId: e.id, targetId: downed.id }); return true;
      }
    }
    if (b.special === 'dive') {
      if (this.world.tick - b.until < 120) {
        if ((this.world.tick - b.until) % 30 === 29) this.attackVictim(e, 5);
        return false;
      }
      return true;
    }
    if (b.special === 'lunge' || b.special === 'charge' || b.special === 'pounce' || b.special === 'cling' || b.special === 'pin' && e.archetype !== 'infected.lion') {
      const distance = Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z);
      if (b.special === 'lunge' && distance > 0.01) {
        // PO 10-09 "running very fast but past me": the lunge homes on the courier (bounded turn, 7 rad/s) instead of
        // flying on along the wind-up line, and ends once she is behind it.
        const tx = (player.transform.x - e.transform.x) / distance, tz = (player.transform.z - e.transform.z) / distance;
        if (tx * b.dx + tz * b.dz < 0) return true;
        const turn = Math.atan2(b.dx * tz - b.dz * tx, b.dx * tx + b.dz * tz), a = Math.atan2(b.dz, b.dx) + Math.max(-7 / 60, Math.min(7 / 60, turn));
        b.dx = Math.cos(a); b.dz = Math.sin(a);
      }
      const step = Math.min(Math.max(0, distance - this.strikeRange(e, player)), this.l3Speed(e, b.special === 'charge' ? 8 : b.special === 'cling' ? 6 : b.special === 'pin' ? 7.5 : 7) / 60);
      if (b.special === 'cling') e.transform.y = 0.7 + Math.sin(Math.min(1, (this.world.tick - b.until) / 60) * Math.PI) * 1.5;
      // Authored leap/charge timing is a combat impulse, like knockback.
      moveAgent(e, b.dx * step * 60, b.dz * step * 60, this.infectedNav, this.world.tick, e.combat!.radius, true); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      if (distance > this.strikeRange(e, player) + 0.15) return this.world.tick >= b.activeUntil;
    }
    if (Math.hypot(player.transform.x - e.transform.x, player.transform.z - e.transform.z) > (b.special === 'aura' ? 3 : this.strikeRange(e, player)) + 0.15) return true;
    this.attackVictim(e, def.damage);
    if (b.special === 'aura') this.world.combat!.status.apply(player, { kind: 'toxic', duration: 2, dps: 3, maxStacks: 1, slow: 0.25 }, e.id, e.archetype, b.attackId);
    if (b.special === 'grab' || b.special === 'combo-grab' || b.special === 'cling' || b.special === 'pounce' || b.special === 'pin' && e.archetype !== 'infected.lion') {
      b.grabUntil = this.world.tick + (b.special === 'cling' ? 120 : b.special === 'pounce' ? 36 : 90); b.grabHits = 0; b.grabNextTick = this.world.tick + 60; b.grabX = player.transform.x; b.grabZ = player.transform.z;
    }
    return true;
  }
  /** Id of the infected whose attack last struck the courier (lunge miss detection). */
  private struck = 0;
  private attackVictim(e: EntitySnapshot, damage: number): void {
    const b = e.infected!, targetId = this.victim(e).id; this.struck = e.id;
    const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId, origin: e.transform, direction: { x: b.dx, z: b.dz }, base: damage, multiplier: e.combat!.damageMultiplier, type: 'melee', knockback: b.special === 'charge' ? 3.2 : 0, stagger: 0 });
    this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId, special: b.special, amount });
  }
  /** PO "Infected recover" is on by default; a level whose scripted encounters still need kills (L3 defense waves) turns it off. */
  recovery = true;
  /**
   * PO "Infected recover": called by Damage on the hit that drops an infected to 0 HP. Returns the tick it gets up, or -1
   * when it is dead for good (explosives, a lethal burn, a bursting bloater, a crow flock, an already settled corpse).
   * The down time is a deterministic per-entity draw (seed, id, knockdown count) that never consumes a shared stream.
   */
  down(e: EntitySnapshot, permanent: boolean): number {
    const b = e.infected!;
    if (b.specialAttack) this.cancelSpecial(e.id);
    if (b.special === 'pin') this.releasePin(e);
    if (permanent || !this.recovery || e.corpse || b.special === 'explode' || e.archetype === 'infected.crow') return b.recoverAt = -1;
    const l3Human = this.world.scenario === 'L3' && (e.archetype === 'infected.runner' || e.archetype === 'infected.sprinter');
    const [low, high] = l3Human ? l3.infected.recoverS : infectedRecovery.downS;
    const u = new Rng(this.world.seed, `infected-recover:${e.id}:${b.downs++}`).next();
    return b.recoverAt = this.world.tick + Math.round((low + (high - low) * u) * 60);
  }
  /** Downed infected stay active and groan once on the ground; at `recoverAt` they get up at full health and hunt by sight again. */
  private recover(e: EntitySnapshot): void {
    const b = e.infected!, c = e.combat!, tick = this.world.tick, getUp = Math.round(infectedRecovery.getUpS * 60);
    e.health.current = e.health.max; b.recoverAt = -1; b.deadAt = -1; b.grabUntil = 0; b.until = 0; b.cooldown = tick + getUp; b.targetId = 0; b.heardTargetId = 0;
    c.attacking = false; c.statuses.length = 0; c.staggerUntil = tick + getUp;
    // The CrowdView heavy reaction plays `get-up` from its 0.7 s mark: start the reaction there and hold still meanwhile.
    c.reaction = { index: c.reaction?.index ?? 0, started: tick - 42, until: tick + getUp, direction: { x: 0, z: 0 }, from: { x: e.transform.x, z: e.transform.z }, to: { x: e.transform.x, z: e.transform.z }, heavy: true };
    const brain = b.l1;
    if (brain) {
      // Back to calm wandering at the spot it lay: only a fresh sighting (cone + LOS) starts a chase again, never a memory.
      Object.assign(brain, { mode: 'wander', hearingUntil: 0, targetId: 0, biteTargetId: 0, distractionId: 0, cueUntil: 0, hasGoal: false, looking: true, lookYaw: e.transform.yaw, pauseUntil: tick + getUp, homeX: e.transform.x, homeZ: e.transform.z, headingX: 0, headingZ: 0, directTick: -1, stuckTick: tick, stuckCount: 0, routeAt: 0, escapeUntil: 0 });
      brain.search.until = 0; b.state = 'wander';
    } else b.state = 'idle';
    b.path.length = 0; b.goal = -1;
    this.world.events.emit({ type: 'infected.recovered', tick, sourceId: e.id, targetId: e.id });
  }
  private dead(e: EntitySnapshot): void {
    const b = e.infected!;
    if (b.recoverAt >= 0) {
      if (this.world.tick >= b.recoverAt) { this.recover(e); return; }
      // One groan from the ground roughly halfway through the down time: "down, not dead".
      if (b.state === 'dead' && this.world.tick === b.deadAt + ((b.recoverAt - b.deadAt) >> 1)) this.world.events.emit({ type: 'infected.groan', tick: this.world.tick, sourceId: e.id, targetId: e.id });
    }
    if (b.state !== 'dead') {
      b.state = 'dead'; b.deadAt = this.world.tick; b.grabUntil = 0;
      // A killed ambusher is a visible ground body, even if it died on a perch
      // or while clinging. The living-only reveal path no longer runs for it.
      if (b.special === 'cling') { b.hidden = false; b.perched = false; e.transform.y = (this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0) + .7; }
      if (e.archetype === 'infected.crow') { for (let i = 0; i < 20; i++) if (b.birdAlive[i]) b.birdDeadMask = (b.birdDeadMask ?? 0) | 1 << i; b.birds = 0; b.birdAlive.fill(0); }
      if (b.special === 'explode' && !this.world.missions?.state.states['cure-released']) { b.attackId = this.nextAttackId(); b.until = this.world.tick + 60; this.world.events.emit({ type: 'telegraph', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, special: 'explode', duration: 1 }); }
    }
    if (b.special === 'explode' && !this.world.missions?.state.states['cure-released'] && this.world.tick === b.until) {
      for (const target of this.world.entities.iterate()) {
        if (target.civilian?.adult === false || target.escort?.child || target === e || target.health.current <= 0 || Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) > 3 || !this.world.combat!.query.visible(e.transform, target.transform)) continue;
        const amount = this.world.combat!.damage.apply({ attackId: b.attackId, actionId: e.archetype, sourceId: e.id, targetId: target.id, origin: e.transform, direction: { x: 0, z: 0 }, base: 35, multiplier: 1, type: 'explosive', radius: 3, knockback: 0, stagger: 0 });
        this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, attackId: b.attackId, targetId: target.id, special: 'explode', amount });
      }
    }
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
      if (distance <= radius && inside) { b.birdAlive[i] = 0; b.birdDeadMask = (b.birdDeadMask ?? 0) | 1 << i; killed++; if (spread === 0) break; }
    }
    b.birds -= killed;
    if (b.birds > 0) { b.state = 'scatter'; b.scatterUntil = this.world.tick + 300; }
    return killed;
  }
  // ---- L1 v2 brain: vision and close hearing, closest human, chase/lunge/bite,
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
      this.l1 = this.hearing; this.l1Rng = new Rng(this.world.seed, 'infected-l1');
      for (const tier of ['frail', 'average', 'athletic'] as const) this.tierStart[tier] = this.l1Rng.next();
    }
    if (humans) this.l1.humans = humans;
    return this.l1;
  }
  private initL1(e: EntitySnapshot, tier: InfectedSpeedTier): void {
    // Per-tier golden-ratio sequence from a seeded start: jitter is uniform over the run, fixed per entity, and
    // infected of one tier spawned together never share a speed (no synchronized group).
    const u = (this.tierStart[tier] + this.tierCount[tier]++ * 0.6180339887498949) % 1, rng = this.l1Rng!;
    const brain: L1Brain = e.infected!.l1 ?? { mode: 'wander', tier, runSpeed: 0, wanderSpeed: 0, targetId: 0, seenX: 0, seenZ: 0, seenTick: 0, headingX: 0, headingZ: 0, looking: false, lookYaw: 0, pauseUntil: 0, goalX: 0, goalZ: 0, hasGoal: false, search: searchPlan(), episodes: 0, distractionId: 0, biteTargetId: 0, direct: false, directTick: -1, directX: 0, directZ: 0, homeX: 0, homeZ: 0, cueUntil: 0, cueYaw: 0, cueSource: 0, stuckX: 0, stuckZ: 0, stuckTick: 0, stuckCount: 0, ignoreId: 0, ignoreUntil: 0 };
    const [low, high] = l1v2.infected.wanderSpeed;
    Object.assign(brain, { mode: 'wander', hearingUntil: 0, leashM: 0, tier, runSpeed: l1TierSpeed(tier, u), reaction: Math.round(l1ReactionS(u) * 60), wanderSpeed: low + rng.next() * (high - low), targetId: 0, headingX: 0, headingZ: 0, looking: true, lookYaw: e.transform.yaw, pauseUntil: this.world.tick + 20 + Math.floor(rng.next() * 40), hasGoal: false, episodes: 0, distractionId: 0, biteTargetId: 0, directTick: -1, homeX: e.transform.x, homeZ: e.transform.z, cueUntil: 0, stuckTick: this.world.tick, stuckCount: 0, ignoreId: 0, ignoreUntil: 0, routeAt: 0, escapeUntil: 0 });
    brain.search.until = 0;
    brain.runSpeed = this.l3Speed(e, brain.runSpeed);
    e.infected!.l1 = brain; e.infected!.speed = brain.runSpeed; e.infected!.state = 'wander';
  }
  /** Live L1 speed of an infected (for tests, bots and animation): its tier run speed. */
  l1Speed(id: number): number { return this.world.entities.get(id)?.infected?.l1?.runSpeed ?? 0; }
  /** L3 regulars stay below courier speed, including bite approach bursts; other levels retain their tuning. */
  private l3Speed(e: EntitySnapshot, speed: number): number {
    return this.world.scenario === 'L3' && e.archetype === 'infected.runner' ? Math.min(speed, l3.infected.maxRegularMs) : speed;
  }
  /** Infected currently holding `civilianId` in a bite grab, or 0. Lane D freezes the victim while this is set. */
  holding(civilianId: number): number {
    for (const e of this.active) if (e.infected!.l1?.mode === 'bite' && e.infected!.l1.biteTargetId === civilianId && e.health.current > 0) return e.id;
    return 0;
  }
  /**
   * Sends an L1 infected running to a point, then searching around it until `untilTick` (distractions, accident exits,
   * director steering). Ignored while it chases or bites.
   */
  rush(id: number, point: { x: number; z: number }, untilTick: number): boolean {
    if (this.l1 && this.flowUntil < 0) this.flowUntil = this.world.tick + l1Ticks(90); // the first rush = the accident exits
    return this.goTo(id, point, untilTick, 0);
  }
  private goTo(id: number, point: { x: number; z: number }, untilTick: number, distractionId: number): boolean {
    const e = this.world.entities.get(id), brain = e?.infected?.l1;
    if (!e || !brain || e.health.current <= 0 || brain.mode === 'chase' || brain.mode === 'bite' || e.infected!.state === 'attack') return false;
    // Pushed bodies retain Respawn's existing pause; gunfire and director goals must not immediately walk them back into its cleared ring.
    if (brain.ignoreId === 1 && this.world.tick < brain.ignoreUntil && this.world.tick < brain.pauseUntil) return false;
    const rng = this.l1Rng!, radius = l1v2.infected.attracted.pointRadiusM;
    brain.goalX = point.x; brain.goalZ = point.z;
    for (let k = 0; k < 6; k++) {
      const angle = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * radius, x = point.x + Math.cos(angle) * r, z = point.z + Math.sin(angle) * r;
      if (this.infectedNav.clear(x, z, e.combat!.radius)) { brain.goalX = x; brain.goalZ = z; break; }
    }
    brain.mode = 'attracted'; e.infected!.state = 'attracted'; brain.hasGoal = true; brain.looking = false; brain.pauseUntil = 0; brain.distractionId = distractionId;
    brain.search.until = untilTick; brain.search.originX = point.x; brain.search.originZ = point.z; brain.search.legTicks = 0;
    return true;
  }
  private distraction(event: DistractionEvent): void {
    if ((this.world.scenario === 'L4' || this.world.scenario === 'L5') && event.kind === 'gunfire') for (const e of this.active) {
      const b = e.infected!;
      if (e.archetype === 'infected.alpha' && e.health.current > 0 && !b.specialAttack && ['idle', 'wander', 'attracted'].includes(b.state) && Math.hypot(e.transform.x - event.position.x, e.transform.z - event.position.z) <= event.radius) {
        b.investigate = { ...event.position }; b.until = event.until; b.state = 'attracted';
      }
    }
    if (!this.l1) return;
    const [low, high] = l1v2.infected.attracted.extraS, rng = this.l1Rng!;
    for (const e of this.active) {
      const brain = e.infected!.l1;
      if (!brain || e.health.current <= 0 || brain.distractionId === event.id) continue;
      if (Math.hypot(e.transform.x - event.position.x, e.transform.z - event.position.z) > event.radius) continue;
      this.goTo(e.id, event.position, event.until + l1Ticks(low + rng.next() * (high - low)), event.id);
    }
  }
  private updateL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const tick = this.world.tick;
    if (Status.stunned(e, tick)) {
      if (brain.mode === 'bite') this.endBite(e, b, brain, false);
      if (b.state === 'attack') { b.state = 'chase'; e.combat!.attacking = false; }
      return;
    }
    if (this.divertFromForecourt(e, b, brain)) return;
    if (b.state === 'attack') {
      const serviceGate = this.world.entities.get(b.targetId)?.archetype === 'l6.service-gate';
      if (tick >= b.until && (this.struck = 0, this.resolve(e))) {
        // A lunge that missed (she side-stepped or outran it) costs a recovery beat: it stops and turns back onto her.
        // This is the dodge window of a run-away game now that the lunge homes and the chaser no longer loses her.
        if (!serviceGate && b.special === 'lunge' && this.struck !== e.id && brain.targetId === 1) {
          const p = this.world.entities.get(1)!.transform;
          brain.pauseUntil = tick + 30; brain.looking = true; brain.lookYaw = -Math.atan2(p.z - e.transform.z, p.x - e.transform.x);
        }
        b.state = 'chase'; b.cooldown = tick + (serviceGate ? 60 : Math.max(0, l1Ticks(l1v2.infected.attackCycleS) - Math.ceil(infectedDef(e.archetype).windup * 60))); e.combat!.attacking = false;
        // The lunge ends planted: bleed its 7 m/s impulse so the next step can turn back onto the courier at once.
        const m = e.locomotion, v = m ? Math.hypot(m.vx, m.vz) : 0;
        if (m && v > 2.5) { m.vx *= 2.5 / v; m.vz *= 2.5 / v; m.ax = m.az = 0; }
      }
      return;
    }
    // Metro gates stop a remembered pursuit. The goal is the last sighting, never a hidden human's live position.
    if (this.world.missions?.state.l6 && brain.seenTick > 0 && (brain.mode === 'chase' || brain.mode === 'search' || brain.mode === 'attracted')) {
      const obstacle=this.world.barricades!.attackTarget(e,{x:brain.seenX,z:brain.seenZ});
      if(obstacle?.archetype==='l6.service-gate') {
        if(!this.world.barricades!.withinReach(e,obstacle))this.steerL1(e,brain,this.world.barricades!.approach(e,obstacle),brain.runSpeed,false,false);
        else if(tick>=b.cooldown){this.windup(e);b.targetId=obstacle.id;}
        this.world.spatial.set(e.id,e.transform.x,e.transform.z);return;
      }
    }
    if (brain.mode === 'bite') { this.updateBite(e, b, brain); return; }
    if (brain.cueUntil > 0) { this.herdTurn(e, b, brain); this.world.spatial.set(e.id, e.transform.x, e.transform.z); return; }
    if ((tick + e.id) % l1Ticks(l1v2.infected.targetReevalS) === 0) this.perceive(e, b, brain);
    if (brain.mode === 'chase') this.chaseL1(e, b, brain);
    else if (brain.mode === 'attracted') this.attractedL1(e, b, brain);
    else if (brain.mode === 'search') this.searchL1(e, b, brain);
    else this.wanderL1(e, b, brain);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
  }
  /** PO 10-15 #4b: while the courier is at the garage (bat pickup) only the nearest `maxPursuers` infected may pursue her.
   * Recomputed from live positions every tick (also after a checkpoint restore); the rest are handled in `divertFromForecourt`.
   * Beyond the garage radius everyone resumes normal pursuit and combat. */
  private prepareForecourt(player: { x: number; z: number }): void {
    this.forecourt = null; this.forecourtPursuers.clear();
    if (this.world.scenario !== 'L1') return;
    const district = this.world.districts?.districts[0], anchor = district?.layout.anchors['garage-door']?.position;
    if (!district || !anchor) return;
    const garage = { x: anchor[0] + district.origin[0], z: anchor[2] + district.origin[1] };
    if (Math.hypot(player.x - garage.x, player.z - garage.z) > l1v2.forecourt.playerRadiusM) return;
    this.forecourt = garage;
    const cfg = l1v2.forecourt;
    const nearby = this.active.filter(e => e.health.current > 0 && e.infected?.l1 && !e.emerging && !e.infectionRise && Math.hypot(e.transform.x - garage.x, e.transform.z - garage.z) < cfg.divertRadiusM);
    nearby.sort((a, b) => Math.hypot(a.transform.x - player.x, a.transform.z - player.z) - Math.hypot(b.transform.x - player.x, b.transform.z - player.z) || a.id - b.id);
    for (const e of nearby.slice(0, cfg.maxPursuers)) this.forecourtPursuers.add(e.id);
  }
  /** The excess lose the courier while she is at the bat, like after a respawn. Those already on their way to her wait `holdM` behind the
   * garage, on the side away from her route to the fire station (a hold ring around her pinned her in; a diversion to the street groups
   * or leaving them where they stood put the pack on her route: complete bot 16 deaths, 464 s). Street wanderers keep their block.
   * Everyone notices her normally again once she is beyond `playerRadiusM`. Population and speeds are untouched. */
  private divertFromForecourt(e: EntitySnapshot, b: InfectedState, brain: L1Brain): boolean {
    const garage = this.forecourt, cfg = l1v2.forecourt;
    if (!garage || this.forecourtPursuers.has(e.id)) return false;
    const away = Math.hypot(e.transform.x - garage.x, e.transform.z - garage.z);
    if (away >= cfg.divertRadiusM) return false;
    // Keep systemic street fights. Only courier pursuit and approaches into the apron are rerouted.
    if (brain.targetId > 1 && (brain.mode === 'chase' || brain.mode === 'bite') && away > cfg.playerRadiusM) return false;
    const tick = this.world.tick;
    brain.ignoreId = 1; brain.ignoreUntil = tick + 90;
    if (brain.mode === 'wander') return false;
    brain.targetId = 0; brain.cueUntil = 0; brain.biteTargetId = 0; brain.looking = false; brain.pauseUntil = 0;
    b.targetId = 0; b.grabUntil = 0; e.combat!.attacking = false;
    const station = this.world.missions?.def.anchors['fire-bay-trigger'];
    const bx = station ? garage.x - station.x : 1, bz = station ? garage.z - station.z : 0, bl = Math.hypot(bx, bz) || 1, side = ((e.id % 7) - 3) * 2.5;
    const cell = this.nav.nearestCell(garage.x + bx / bl * cfg.holdM - bz / bl * side, garage.z + bz / bl * cfg.holdM + bx / bl * side, e.combat!.radius);
    if (cell < 0) { brain.mode = 'wander'; brain.hasGoal = false; b.state = 'wander'; return false; }
    brain.mode = 'attracted'; brain.goalX = this.nav.x(cell); brain.goalZ = this.nav.z(cell); brain.hasGoal = true;
    brain.search.until = tick + 90; b.state = 'attracted';
    return false;
  }
  /** Re-evaluates the closest visible human (0.25 s cadence); losing every human while chasing starts a search. */
  private perceive(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const seen = this.l1!.closest(e, brain.mode === 'chase' ? brain.targetId : 0, this.world.tick < brain.ignoreUntil ? brain.ignoreId : 0);
    if (seen) { this.sight(e, b, brain, seen); return; }
    if (brain.mode === 'chase') this.startSearch(b, brain, { x: brain.seenX, z: brain.seenZ }, { x: brain.headingX, z: brain.headingZ });
    else this.herdCue(e, brain);
  }
  /**
   * Herd cue (PO request 2026-10-07): an infected that SEES another infected chasing or biting (cone + LOS) snaps toward
   * the attacker's running direction (~0.3 s), then looks again; with no human in view it follows that heading for a
   * few seconds. Sight only: the cue is a visible attacker, so chains propagate naturally.
   */
  private herdCue(e: EntitySnapshot, brain: L1Brain): void {
    this.query.x = e.transform.x; this.query.z = e.transform.z; this.query.r = this.l1!.rangeM;
    this.world.spatial.query(this.query, this.neighbors, false);
    // Sort only potential cues, retaining the original lowest-ID visible choice.
    let count = 0;
    for (const id of this.neighbors) {
      const other = this.world.entities.get(id), ob = other?.infected?.l1;
      if (other && other !== e && ob && other.health.current > 0 && (ob.mode === 'chase' || ob.mode === 'bite' || other.infected!.state === 'attack')) this.neighbors[count++] = id;
    }
    this.neighbors.length = count; this.neighbors.sort((a, b) => a - b);
    for (const id of this.neighbors) {
      const other = this.world.entities.get(id), ob = other?.infected?.l1;
      if (!other || other === e || !ob || other.health.current <= 0 || (ob.mode !== 'chase' && ob.mode !== 'bite' && other.infected!.state !== 'attack')) continue;
      if (!this.l1!.sees(e, other.transform)) continue;
      const v = other.locomotion, speed = v ? Math.hypot(v.vx, v.vz) : 0;
      brain.cueYaw = speed > 0.3 ? -Math.atan2(v!.vz, v!.vx) : other.transform.yaw;
      brain.cueUntil = this.world.tick + 24; brain.cueSource = other.id; brain.looking = true; brain.lookYaw = brain.cueYaw;
      return;
    }
  }
  private herdTurn(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const tick = this.world.tick, delta = Math.atan2(Math.sin(brain.cueYaw - e.transform.yaw), Math.cos(brain.cueYaw - e.transform.yaw)), step = 10 / 60;
    e.transform.yaw += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;
    if (Math.abs(delta) > step && tick < brain.cueUntil) return;
    brain.cueUntil = 0;
    const seen = this.l1!.closest(e, 0, this.world.tick < brain.ignoreUntil ? brain.ignoreId : 0);
    if (seen) { this.sight(e, b, brain, seen); return; }
    if (brain.distractionId !== 0) return; // a car alarm outranks a cue that showed no human (visible human > distraction > wander)
    const rng = this.l1Rng!, run = 8 + rng.next() * 4, fx = Math.cos(brain.cueYaw), fz = -Math.sin(brain.cueYaw);
    this.goTo(e.id, { x: e.transform.x + fx * run, z: e.transform.z + fz * run }, tick + l1Ticks(2 + rng.next()), 0);
  }
  private sight(e: EntitySnapshot, b: InfectedState, brain: L1Brain, seen: HumanTarget): void {
    const tick = this.world.tick, heard = !this.l1!.sees(e, seen.position);
    if (brain.mode === 'chase' && brain.targetId === seen.id) {
      const dx = seen.position.x - brain.seenX, dz = seen.position.z - brain.seenZ, d = Math.hypot(dx, dz);
      if (d > 0.05) { brain.headingX = dx / d; brain.headingZ = dz / d; }
    } else {
      // A fresh sighting from calm: a brief readable "notice" beat (stop, snap toward the human), then the run.
      // Searching infected are already hunting and re-acquire without it.
      const reacting = brain.mode === 'wander' || (brain.mode === 'search' && brain.distractionId !== 0) || brain.mode === 'attracted';
      if (reacting) { brain.pauseUntil = tick + (heard ? hearingReactionTicks : 12 + (brain.reaction ?? 0)); brain.looking = true; brain.lookYaw = -Math.atan2(seen.position.z - e.transform.z, seen.position.x - e.transform.x); }
      brain.hearingUntil = heard && reacting ? tick + hearingReactionTicks : 0;
      brain.headingX = brain.headingZ = 0; brain.distractionId = 0; brain.cueUntil = 0;
      this.world.events.emit({ type: 'ai.alerted', tick, sourceId: seen.id, targetId: e.id, cause: heard ? 'hearing' : 'sight', position: { ...e.transform } });
    }
    brain.mode = 'chase'; b.state = 'chase'; brain.targetId = seen.id; brain.seenX = seen.position.x; brain.seenZ = seen.position.z; brain.seenTick = tick;
  }
  private startSearch(b: InfectedState, brain: L1Brain, origin: { x: number; z: number }, heading: { x: number; z: number }): void {
    const [low, high] = l1v2.infected.search.durationS, rng = this.l1Rng!;
    planSearch(brain.search, rng, this.infectedNav, this.world.tick, origin, heading, l1Ticks(low + rng.next() * (high - low)));
    brain.mode = 'search'; b.state = 'search'; brain.targetId = 0; brain.looking = false; brain.pauseUntil = 0; brain.episodes++;
  }
  private chaseL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const target = this.l1!.humans.get(brain.targetId);
    if (!target) { this.startSearch(b, brain, { x: brain.seenX, z: brain.seenZ }, { x: brain.headingX, z: brain.headingZ }); return; }
    if (this.world.tick < brain.pauseUntil) { this.look(e, brain); return; }
    brain.looking = false;
    const distance = Math.hypot(target.position.x - e.transform.x, target.position.z - e.transform.z), lunge = l1v2.infected.lungeRangeM;
    if (target.kind === 'player') {
      // Strike with clear sight, or at arm's reach even past a thin post/lamp (PO-QA #13: no frozen stand-off).
      const strikable = this.l1!.lineOfSight(e.transform, target.position) || distance <= 1.6;
      if (distance <= lunge && this.world.tick >= b.cooldown && strikable) { b.combo = 0; this.windup(e); return; }
      // QA2-04: hold at arm's reach between swings instead of walking into the courier's body.
      if (distance < Math.max(1.3, infectedContactDistance(e.combat!.radius)) && strikable) { brain.stuckTick = this.world.tick; brain.stuckX = e.transform.x; brain.stuckZ = e.transform.z; e.transform.yaw = -Math.atan2(target.position.z - e.transform.z, target.position.x - e.transform.x); return; }
      // L4 (l4-collapse-2: "corpse heaps around a camping courier"): around a courier standing still the chasers take a slot on a ring
      // (per id, at most ~90 degrees around from where they come) instead of queueing behind the first one; past the first eight closer
      // chasers a body waits on an outer ring (1.1 m further out per eight) rather than pressing into a mound. The strike rule is unchanged.
      if (distance > 1.7 && distance < 7 && this.world.missions?.state.l4 && this.courierStill()) {
        let ahead = 0; const d2 = distance * distance;
        for (const o of this.active) if (o !== e && o.health.current > 0 && o.infected?.l1?.targetId === 1 && (o.transform.x - target.position.x) ** 2 + (o.transform.z - target.position.z) ** 2 < d2) ahead++;
        const ring = Math.min(4.7, 1.4 + 1.1 * Math.floor(ahead / 8));
        const slot = (e.id * 2.399963) % (Math.PI * 2), bearing = Math.atan2(e.transform.z - target.position.z, e.transform.x - target.position.x);
        const a = bearing + Math.max(-1.6, Math.min(1.6, Math.atan2(Math.sin(slot - bearing), Math.cos(slot - bearing))));
        this.ringPoint.x = target.position.x + Math.cos(a) * ring; this.ringPoint.z = target.position.z + Math.sin(a) * ring;
        if (ring > 1.4 && Math.abs(distance - ring) < .5) { e.transform.yaw = -Math.atan2(target.position.z - e.transform.z, target.position.x - e.transform.x); return; }
        if (this.infectedNav.clear(this.ringPoint.x, this.ringPoint.z, e.combat!.radius)) { this.steerL1(e, brain, this.ringPoint, brain.runSpeed, true, true); return; }
      }
      this.steerL1(e, brain, target.position, brain.runSpeed, true, true);
      return;
    }
    // Civilians: runner lunge burst inside 2.5 m, then grab on contact.
    const contact = e.combat!.radius + (this.world.entities.get(target.id)?.combat?.radius ?? .35) + .3;
    if (distance <= contact && this.l1!.lineOfSight(e.transform, target.position)) { this.startBite(e, b, brain, target); return; }
    this.steerL1(e, brain, target.position, distance <= lunge ? Math.min(7, brain.runSpeed * 1.25) : brain.runSpeed, false, true);
  }
  private startBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain, target: HumanTarget): void {
    const tick = this.world.tick, victim = this.world.entities.get(target.id);
    brain.mode = 'bite'; b.state = 'bite'; brain.biteTargetId = target.id; b.grabHits = 0; b.grabUntil = tick + l1Ticks(l1v2.civilians.grabS); e.combat!.attacking = true;
    e.transform.yaw = -Math.atan2(target.position.z - e.transform.z, target.position.x - e.transform.x);
    this.world.events.emit({ type: 'civilian.grabbed', tick, sourceId: e.id, targetId: target.id, variant: victim?.civilian?.variant ?? victim?.archetype ?? '', rescueUntil: b.grabUntil });
  }
  private updateBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const victim = this.victimPosition(brain.biteTargetId);
    // Any hit on the infected during the grab rescues the victim (rescue window = the 1.0 s grab).
    if (b.grabHits > 0 || !victim || Math.hypot(victim.x - e.transform.x, victim.z - e.transform.z) > e.combat!.radius + (this.world.entities.get(brain.biteTargetId)?.combat?.radius ?? .35) + 1.1 || !this.l1!.lineOfSight(e.transform, victim)) { this.endBite(e, b, brain, false); return; }
    e.transform.yaw = -Math.atan2(victim.z - e.transform.z, victim.x - e.transform.x);
    if (this.world.tick >= b.grabUntil) this.endBite(e, b, brain, true);
  }
  /** A grabbed civilian may leave the huntable set (lane D marks it grabbed); its body is still where the bite lands. */
  private victimPosition(id: number): { x: number; z: number } | undefined {
    const human = this.l1!.humans.get(id); if (human) return human.position;
    const e = this.world.entities.get(id);
    return e?.civilian && e.health.current > 0 && !e.hidden && ['grabbed', 'calm', 'alarmed', 'flee', 'hide'].includes(e.civilian.state) ? e.transform : undefined;
  }
  private endBite(e: EntitySnapshot, b: InfectedState, brain: L1Brain, bitten: boolean): void {
    const tick = this.world.tick, victimId = brain.biteTargetId, victim = this.victimPosition(victimId);
    b.grabUntil = 0; e.combat!.attacking = false; brain.biteTargetId = 0;
    const target = this.world.entities.get(victimId);
    if (bitten && victim && (!target || !isCorgi(target) && !storyProtected(this.world, target))) {
      while (this.recentTurns.length && tick - this.recentTurns[0] > l1Ticks(l1v2.civilians.transformS + l1v2.civilians.transformJitterS)) this.recentTurns.shift();
      // At the cap a bite kills instead of turning (L1 section 5.9): L1/L2 60 high / 30 low; a strict level cap (L3: 80 / 40).
      const cap = this.director.strict || target?.civilian?.zooAnimal ? this.director.cap : this.director.tier === 'low' ? l1v2.director.capLow : l1v2.director.capHigh, turns = this.director.count + this.recentTurns.length < cap - this.director.reserved;
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
      planSearch(s, this.l1Rng!, this.infectedNav, tick, { x: s.originX, z: s.originZ }, { x: 0, z: 0 }, s.until - tick, [3, 7]);
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
      const n = s.probes.length, last = n ? Math.atan2(s.probes[n - 1] - s.originZ, s.probes[n - 2] - s.originX) : 0;
      const angle = last + (rng.next() * 2 - 1) * 1.5, r = low + rng.next() * (high - low), x = s.originX + Math.cos(angle) * r, z = s.originZ + Math.sin(angle) * r;
      if (this.infectedNav.clear(x, z, 0.45)) { s.probes.push(x, z); return; }
    }
    s.probes.push(s.originX + 4, s.originZ);
  }
  private toWander(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    brain.mode = 'wander'; b.state = 'wander'; brain.hasGoal = false; brain.distractionId = 0;
    brain.looking = true; brain.lookYaw = e.transform.yaw + Math.PI * (this.l1Rng!.next() - 0.5); brain.pauseUntil = this.world.tick + 60 + Math.floor(this.l1Rng!.next() * 60);
  }
  /** Civilians (never the survivor) within 18 m of a point: wander drifts toward populated blocks. */
  private readonly crowdAt = (x: number, z: number): number => {
    let count = 0; for (const h of this.l1!.humans.within({ x, z }, 18)) if (h.kind === 'civilian') count++;
    return count;
  };
  /** First 90 s after the accident exits: wander follows the "panic flow" toward the densest civilian blocks. */
  private flowUntil = -1;
  private flowTick = -1;
  private readonly flowCells = new Map<number, { x: number; z: number; n: number }>();
  /** Civilian density on a coarse 20 m grid (civilians only, never the survivor), rebuilt once per second. */
  private civilianBlocks(): Map<number, { x: number; z: number; n: number }> {
    if (this.world.tick - this.flowTick < 60 && this.flowTick >= 0) return this.flowCells;
    this.flowTick = this.world.tick; this.flowCells.clear();
    for (const h of this.l1!.humans.all()) {
      if (h.kind !== 'civilian') continue;
      const key = Math.floor(h.position.x / 20) * 1000 + Math.floor(h.position.z / 20), cell = this.flowCells.get(key);
      if (cell) { cell.x += h.position.x; cell.z += h.position.z; cell.n++; } else this.flowCells.set(key, { x: h.position.x, z: h.position.z, n: 1 });
    }
    return this.flowCells;
  }
  /** Goal up to 18 m along the route toward the most attractive civilian block (count, discounted by distance). */
  private panicGoal(e: EntitySnapshot, brain: L1Brain): boolean {
    let best = -Infinity, tx = 0, tz = 0;
    for (const cell of this.civilianBlocks().values()) {
      const cx = cell.x / cell.n, cz = cell.z / cell.n, d = Math.hypot(cx - e.transform.x, cz - e.transform.z);
      const score = cell.n * Math.exp(-d / 45) * (0.8 + this.l1Rng!.next() * 0.4);
      if (d > 4 && score > best) { best = score; tx = cx; tz = cz; }
    }
    if (best === -Infinity) return wanderGoal(brain, this.l1Rng!, this.infectedNav, e.transform, this.crowdAt);
    const d = Math.hypot(tx - e.transform.x, tz - e.transform.z), k = Math.min(1, 18 / d);
    const cell = this.infectedNav.nearestCell(e.transform.x + (tx - e.transform.x) * k, e.transform.z + (tz - e.transform.z) * k);
    if (cell < 0) return wanderGoal(brain, this.l1Rng!, this.infectedNav, e.transform, this.crowdAt);
    brain.goalX = this.infectedNav.x(cell); brain.goalZ = this.infectedNav.z(cell); brain.hasGoal = true;
    return true;
  }
  private wanderL1(e: EntitySnapshot, b: InfectedState, brain: L1Brain): void {
    const tick = this.world.tick, rng = this.l1Rng!;
    if (tick < brain.pauseUntil) { this.look(e, brain); return; }
    brain.looking = false;
    // E20: leashed street groups keep to their block; the panic flow pulls only free wanderers.
    const flow = tick < this.flowUntil && !brain.leashM;
    if (!brain.hasGoal) {
      if (!(flow ? this.panicGoal(e, brain) : wanderGoal(brain, rng, this.infectedNav, e.transform, this.crowdAt))) {
        // No open goal in view (standing in a slot narrower than the nav clearance): first walk out to the nearest open cell.
        const cell = this.infectedNav.escapeCell(e.transform, e.combat!.radius * 0.6, 8, false, 2.5);
        if (cell < 0) { brain.pauseUntil = tick + 30; return; }
        brain.goalX = this.infectedNav.x(cell); brain.goalZ = this.infectedNav.z(cell); brain.hasGoal = true;
      }
      brain.search.legTicks = 0;
    }
    const distance = Math.hypot(brain.goalX - e.transform.x, brain.goalZ - e.transform.z);
    if (distance <= (flow ? 1.5 : 0.8) || ++brain.search.legTicks > (flow ? 420 : 900)) {
      brain.hasGoal = false; brain.looking = true; brain.lookYaw = e.transform.yaw + (rng.next() - 0.5) * 2.6;
      brain.pauseUntil = tick + (flow ? 12 + Math.floor(rng.next() * 24) : 60 + Math.floor(rng.next() * 150));
      return;
    }
    // Panic flow: drawn along the streets after the commotion, a brisk prowl instead of a drift.
    this.steerL1(e, brain, { x: brain.goalX, z: brain.goalZ }, flow ? brain.wanderSpeed * 1.5 : brain.wanderSpeed);
  }
  /** Standing look-around: turn the body toward `lookYaw` at a bounded rate, then sweep back the other way. */
  private look(e: EntitySnapshot, brain: L1Brain): void {
    const delta = Math.atan2(Math.sin(brain.lookYaw - e.transform.yaw), Math.cos(brain.lookYaw - e.transform.yaw)), step = ((brain.hearingUntil ?? 0) > this.world.tick ? hearingTurnRadS : 3.2) / 60;
    if (Math.abs(delta) <= step) { e.transform.yaw = brain.lookYaw; if (brain.mode !== 'chase') brain.lookYaw = e.transform.yaw - Math.sign(delta || 1) * (0.8 + this.l1Rng!.next() * 0.9); }
    else e.transform.yaw += Math.sign(delta) * step;
  }
  /** Preserve unique ids even after restoring entity records from a checkpoint. */
  private nextAttackId(): number {
    return ++this.sequence;
  }
  /** Rebase serialized timers when a checkpoint is restored at a later world tick. */
  restoreSpecialTimers(b: InfectedState, delta: number): void {
    this.sequence = Math.max(this.sequence, b.attackId, b.specialAttack?.attackId ?? 0, b.roar?.attackId ?? 0);
    if (b.megaStaggerReady !== undefined) b.megaStaggerReady += delta;
    if (b.specialAttack?.grabReleaseTick !== undefined) b.specialAttack.grabReleaseTick += delta;
    if (b.roar) { b.roar.until += delta; if (b.roar.speedUntil !== undefined) b.roar.speedUntil += delta; }
    if (b.specialAttack?.projectile) b.specialAttack.projectile.started += delta;
    if (b.specialAttack?.impactTick !== undefined) b.specialAttack.impactTick += delta;
    if (b.specialAttack?.obstructionUntil) b.specialAttack.obstructionUntil += delta;
    if (b.specialRecoveryUntil) b.specialRecoveryUntil += delta;
    if (b.specialCooldowns) for (const move of Object.keys(b.specialCooldowns) as InfectedSpecialMove[]) b.specialCooldowns[move]! += delta;
    const a = b.specialAttack;
    if (a) { a.startTick += delta; a.activeTick += delta; a.cooldownExpiry += delta; if (a.recoveryUntil) a.recoveryUntil += delta; }
  }
  /** The move resolver chooses a visible/last-seen target. This copies and locks its position. */
  startSpecial(sourceId: number, move: InfectedSpecialMove, target: { id: number; x: number; z: number }, area: { x: number; z: number; radius: number; dx: number; dz: number }, follower = false): boolean {
    const e = this.world.entities.get(sourceId), b = e?.infected, timing = e?.infected?.pursuit && move in megaAlpha.moves ? megaAlpha.moves[move as keyof typeof megaAlpha.moves] : infectedSpecialMoves[move], tick = this.world.tick;
    if (!e || !b || e.archetype !== infectedSpecialMoves[move].archetype || e.health.current <= 0 || b.specialAttack || b.state === 'attack' || tick < b.cooldown || tick < (b.specialRecoveryUntil ?? 0) || tick + timing.windup < (b.specialCooldowns?.[move] ?? 0) || Status.stunned(e, tick)) return false;
    if (![target.x, target.z, area.x, area.z, area.radius, area.dx, area.dz].every(Number.isFinite) || area.radius < 0) return false;
    if (b.pursuit && (!(move in megaAlpha.moves) || Math.hypot(target.x - e.transform.x, target.z - e.transform.z) > megaAlpha.closeM || !this.megaSpecialClear(e))) return false;
    let members: EntitySnapshot[] | undefined;
    if (!follower && (move === 'zebra.stampede' || move === 'flamingo.dive')) {
      const limit = move === 'zebra.stampede' ? 4 : 8;
      members = [e];
      for (const other of this.active) {
        const ob = other.infected!;
        if (other.id === e.id || other.archetype !== e.archetype || other.health.current <= 0 || other.hidden || other.emerging || ob.specialAttack || ob.state === 'attack' || tick < ob.cooldown || tick < (ob.specialRecoveryUntil ?? 0) || tick + timing.windup < (ob.specialCooldowns?.[move] ?? 0) || Status.stunned(other, tick) || Math.hypot(other.transform.x - e.transform.x, other.transform.z - e.transform.z) > 12 || !this.world.combat!.query.visible(e.transform, other.transform) || !this.physicalPropVisible(e.transform, other.transform)) continue;
        members.push(other); if (members.length === limit) break;
      }
      if (members.length < (move === 'zebra.stampede' ? 2 : 3)) return false;
    }
    const attackId = this.nextAttackId(), activeTick = tick + timing.windup;
    let destination: { x: number; z: number } | undefined;
    b.attackId = attackId;
    if (move === 'alpha.grab-throw' || move === 'gorilla.grab-throw' || move === 'alpha.roar') { if (e.locomotion) resetResponse(e.locomotion); b.dx = area.dx; b.dz = area.dz; }
    if (!follower && ['zebra.kick', 'zebra.stampede', 'flamingo.dive', 'alpha.charge', 'alpha.ground-slam', 'lion.pounce', 'lion.flank', 'gorilla.pound', 'gorilla.roar', 'elephant.charge', 'elephant.swipe', 'gorilla.grab-throw'].includes(move)) {
      const dx = target.x - e.transform.x, dz = target.z - e.transform.z, length = Math.hypot(dx, dz);
      area = { x: e.transform.x, z: e.transform.z, radius: move === 'zebra.kick' ? 2 : move === 'zebra.stampede' ? .75 : move === 'flamingo.dive' ? 3 : move === 'elephant.charge' ? 1.75 : move === 'elephant.swipe' ? 3 : move === 'gorilla.pound' ? 5 : move === 'gorilla.roar' ? 20 : move === 'alpha.ground-slam' ? 4 : 1, dx: length > .001 ? dx / length : Math.cos(e.transform.yaw), dz: length > .001 ? dz / length : -Math.sin(e.transform.yaw) };
      if (move === 'zebra.kick') { area.dx = -Math.cos(e.transform.yaw); area.dz = Math.sin(e.transform.yaw); }
      if (move === 'flamingo.dive') { area.x = target.x; area.z = target.z; }
      if (move === 'lion.flank') {
        // End at the visible target's side: a deterministic 75 degree approach offset.
        const side = e.id % 2 ? 1 : -1, r = Math.min(6, Math.max(2, length));
        destination = { x: target.x - area.dx * r * Math.cos(Math.PI * 5 / 12) - area.dz * side * r * Math.sin(Math.PI * 5 / 12), z: target.z - area.dz * r * Math.cos(Math.PI * 5 / 12) + area.dx * side * r * Math.sin(Math.PI * 5 / 12) };
        const fx = destination.x - area.x, fz = destination.z - area.z, d = Math.hypot(fx, fz);
        area.dx = fx / (d || 1); area.dz = fz / (d || 1);
      }
      if (e.locomotion) resetResponse(e.locomotion);
      if (move !== 'zebra.kick') e.transform.yaw = -Math.atan2(area.dz, area.dx);
    }
    if (b.pursuit) {
      const tune = megaAlpha.moves[move as keyof typeof megaAlpha.moves];
      const dx = target.x - e.transform.x, dz = target.z - e.transform.z, length = Math.hypot(dx, dz);
      area = { x: e.transform.x, z: e.transform.z, radius: tune.radius, dx: dx / (length || 1), dz: dz / (length || 1) };
      e.transform.yaw = -Math.atan2(area.dz, area.dx);
    }
    b.specialAttack = { move, attackId, stage: 'telegraph', startTick: tick, activeTick, cooldownExpiry: activeTick + timing.cooldown, recoveryUntil: 0, target: { ...target }, area: { ...area }, hitIds: [], ...(destination ? { destination } : {}) };
    e.combat!.attacking = true;
    this.world.events.emit({ type: 'telegraph', tick, sourceId, attackId, special: move, move, duration: timing.windup / 60, startTick: tick, activeTick, cooldownExpiry: activeTick + timing.cooldown, target: { ...target }, area: { ...area } });
    if (members) {
      const ids = members.map(member => member.id);
      Object.assign(b.specialAttack, { members: ids, leaderId: e.id });
      for (const member of members.slice(1)) {
        const memberArea = move === 'flamingo.dive' ? area : { ...area, x: member.transform.x, z: member.transform.z };
        this.startSpecial(member.id, move, target, memberArea, true);
        Object.assign(member.infected!.specialAttack!, { members: ids, leaderId: e.id });
        if (member.locomotion) resetResponse(member.locomotion);
        member.transform.yaw = -Math.atan2(area.dz, area.dx);
      }
    }
    return true;
  }
  private tryZooSpecial(e: EntitySnapshot, target: EntitySnapshot): boolean {
    if (e.archetype !== 'infected.lion' && e.archetype !== 'infected.gorilla' && e.archetype !== 'infected.elephant' && e.archetype !== 'infected.zebra' && e.archetype !== 'infected.flamingo') return false;
    const distance = Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z);
    if (!this.hearing.tracks(e, target.transform)) return false;
    const rear = ((target.transform.x - e.transform.x) * -Math.cos(e.transform.yaw) + (target.transform.z - e.transform.z) * Math.sin(e.transform.yaw)) >= distance * Math.SQRT1_2;
    const moves: InfectedSpecialMove[] = e.archetype === 'infected.zebra' ? distance <= 2 && rear ? ['zebra.kick', 'zebra.stampede'] : distance <= 15 ? ['zebra.stampede'] : [] : e.archetype === 'infected.flamingo' ? distance <= 12 ? ['flamingo.dive'] : [] : e.archetype === 'infected.lion' ? distance <= 8 ? ['lion.pounce', 'lion.flank'] : distance <= 14 ? ['lion.flank'] : [] : e.archetype === 'infected.elephant' ? distance <= 3 ? ['elephant.swipe', 'elephant.charge'] : distance <= 16 ? ['elephant.charge'] : [] : distance <= 5 ? ['gorilla.grab-throw', 'gorilla.pound', 'gorilla.roar'] : distance <= 15 ? ['gorilla.grab-throw', 'gorilla.roar'] : [];
    for (const move of moves) if ((move !== 'gorilla.grab-throw' || !!this.props.nearestObject(e, 3)) && (move !== 'lion.flank' || this.hearing.sees(e, target.transform)) && this.startSpecial(e.id, move, { id: target.id, x: target.transform.x, z: target.transform.z }, { x: e.transform.x, z: e.transform.z, radius: 1, dx: 1, dz: 0 })) return true;
    return false;
  }
  /** Active resolvers call this before each target effect, never during the windup. */
  specialHit(sourceId: number, targetId: number): boolean {
    const a = this.world.entities.get(sourceId)?.infected?.specialAttack;
    if (!a || a.stage !== 'active' || a.hitIds.includes(targetId)) return false;
    a.hitIds.push(targetId); return true;
  }
  finishSpecial(sourceId: number): boolean {
    const e = this.world.entities.get(sourceId), b = e?.infected, a = b?.specialAttack;
    if (!e || !b || !a || a.stage !== 'active') return false;
    if (a.move === 'lion.pounce') e.transform.y = (this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0) + .7;
    if (e.locomotion) resetResponse(e.locomotion);
    a.stage = 'recovery'; a.recoveryUntil = Math.max(this.world.tick + (b.pursuit ? megaAlpha.recoveryTicks : infectedSpecialRecoveryTicks), a.obstructionUntil ?? 0);
    b.specialRecoveryUntil = a.recoveryUntil; e.combat!.attacking = false;
    this.world.events.emit({ type: 'infected.special', tick: this.world.tick, sourceId, move: a.move, attackId: a.attackId, stage: 'recovery' }); return true;
  }
  cancelSpecial(sourceId: number): void {
    const e = this.world.entities.get(sourceId), b = e?.infected, a = b?.specialAttack;
    if (!e || !b || !a) return;
    if (b.pursuit) (b.specialCooldowns ??= {})[a.move] = a.cooldownExpiry;
    this.releaseMegaGrab(a);
    this.props.settleSpecial(a);
    if (a.move === 'lion.pounce') e.transform.y = (this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0) + .7;
    b.specialRecoveryUntil = Math.max(b.specialRecoveryUntil ?? 0, this.world.tick + (b.pursuit ? megaAlpha.recoveryTicks : infectedSpecialRecoveryTicks));
    this.world.events.emit({ type: 'infected.special', tick: this.world.tick, sourceId, move: a.move, attackId: a.attackId, stage: 'cancelled' });
    delete b.specialAttack; e.combat!.attacking = false;
  }
  private updateSpecial(e: EntitySnapshot): boolean {
    const b = e.infected!, a = b.specialAttack, tick = this.world.tick;
    if (!a) return tick < (b.specialRecoveryUntil ?? 0);
    if (a.stage === 'telegraph' && (a.move === 'alpha.grab-throw' || a.move === 'gorilla.grab-throw' || a.move === 'alpha.roar')) {
      const yaw = -Math.atan2(a.area.dz, a.area.dx), delta = Math.atan2(Math.sin(yaw - e.transform.yaw), Math.cos(yaw - e.transform.yaw));
      e.transform.yaw += Math.max(-hearingTurnRadS / 60, Math.min(hearingTurnRadS / 60, delta));
    }
    if (a.stage === 'telegraph' && tick >= a.activeTick) {
      if (Status.stunned(e, tick)) { this.cancelSpecial(e.id); return true; }
      a.stage = 'active'; (b.specialCooldowns ??= {})[a.move] = a.cooldownExpiry;
      this.world.events.emit({ type: 'infected.special', tick, sourceId: e.id, move: a.move, attackId: a.attackId, stage: 'active' });
    }
    if (b.pursuit && (Status.stunned(e, tick) || !this.megaSpecialClear(e))) { this.cancelSpecial(e.id); return true; }
    if (b.pursuit && a.move === 'alpha.grab-throw') this.resolveMegaGrab(e);
    else this.alphaSupport.update(e);
    if (a.stage === 'active' && a.move === 'flamingo.dive') this.resolveFlockDive(e);
    if (a.stage === 'recovery' && tick >= a.recoveryUntil) {
      this.world.events.emit({ type: 'infected.special', tick, sourceId: e.id, move: a.move, attackId: a.attackId, stage: 'expiry' });
      delete b.specialAttack; return false;
    }
    if (a.stage === 'active' && ['alpha.charge', 'alpha.ground-slam', 'lion.pounce', 'lion.flank', 'gorilla.pound', 'elephant.charge', 'elephant.swipe', 'zebra.kick', 'zebra.stampede'].includes(a.move)) this.resolvePhysical(e);
    return true;
  }
  /** Fixed, locked physical moves use combat hits, E26 blockers and the existing human hurt state. */
  private resolvePhysical(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!, mega = !!e.infected!.pursuit;
    const pounce = a.move === 'lion.pounce', pound = a.move === 'gorilla.pound', elephant = a.move === 'elephant.charge', swipe = a.move === 'elephant.swipe', kick = a.move === 'zebra.kick', zebra = a.move === 'zebra.stampede';
    const q = this.world.combat!.query, p = e.transform, direction = this.physicalDirection;
    direction.x = a.area.dx; direction.z = a.area.dz;
    if (a.move === 'lion.flank') {
      if (this.world.tick - a.activeTick >= 120 || !a.destination || Math.hypot(p.x - a.destination.x, p.z - a.destination.z) <= e.combat!.radius + .5) { this.finishSpecial(e.id); return; }
      this.seek(e, a.destination, 10); this.world.spatial.set(e.id, p.x, p.z); return;
    }
    if (a.move === 'alpha.ground-slam' || pound || swipe || kick) {
      const radius = kick ? 2 : swipe ? 3 : pound ? 5 : 4;
      this.physicalQuery.x = a.area.x; this.physicalQuery.z = a.area.z; this.physicalQuery.r = radius + 1e-8;
      this.world.spatial.query(this.physicalQuery, this.physicalNeighbors);
      for (const id of this.physicalNeighbors) {
        const target = this.world.entities.get(id);
        if (!target || !this.physicalHuman(target) || Math.hypot(target.transform.x - a.area.x, target.transform.z - a.area.z) > radius + 1e-8 || !q.visible(a.area, target.transform) || !this.physicalPropVisible(a.area, target.transform)) continue;
        if (swipe || kick) { const dx = target.transform.x - a.area.x, dz = target.transform.z - a.area.z; if (dx * a.area.dx + dz * a.area.dz < Math.hypot(dx, dz) * (kick ? Math.SQRT1_2 : .5) - 1e-8) continue; }
        this.physicalHit(e, target, mega ? megaAlpha.moves['alpha.ground-slam'].damage : kick ? 20 : pound ? 30 : 25);
      }
      this.finishSpecial(e.id); return;
    }
    const hitRadius = mega ? megaAlpha.moves['alpha.charge'].radius : pounce ? infectedContactDistance(e.combat!.radius) : elephant ? 1.75 : zebra ? .75 : 1;
    const travelled = (p.x - a.area.x) * a.area.dx + (p.z - a.area.z) * a.area.dz;
    const range = mega ? Math.min(megaAlpha.moves['alpha.charge'].range, megaAlpha.moves['alpha.charge'].speed) : pounce ? Math.min(8, Math.hypot(a.target.x - a.area.x, a.target.z - a.area.z)) : elephant ? 16 : zebra ? 15 : 12;
    const step = Math.min((mega ? megaAlpha.moves['alpha.charge'].speed : pounce || zebra ? 10 : elephant ? 8 : 9) / 60, Math.max(0, range - travelled));
    let distance = this.physicalClearDistance(e, direction, step);
    if (pounce) {
      const target = this.world.entities.get(a.target.id);
      if (target && this.physicalHuman(target)) {
        const dx = target.transform.x - p.x, dz = target.transform.z - p.z, along = dx * direction.x + dz * direction.z;
        const lateral = dx * direction.z - dz * direction.x;
        if (along >= 0 && Math.abs(lateral) <= hitRadius) distance = Math.min(distance, Math.max(0, along - Math.sqrt(hitRadius ** 2 - lateral ** 2)));
      }
    }
    // Break only the nearest contacted E26 blocker. Re-query immediately after its ordinary hit event clears nav.
    for (let tries = 0; !pounce && !zebra && distance < step && tries < 8; tries++) {
      let wall = q.dynamicWalls.find(w => w.entityId !== undefined && q.wallDistance(w, p, direction, step, elephant ? hitRadius : e.combat!.radius) <= distance + 1e-8);
      if (!wall) for (const propWall of this.world.props?.navWalls.values() ?? []) if (q.wallDistance(propWall, p, direction, step, elephant ? hitRadius : e.combat!.radius) <= distance + 1e-8) { wall = propWall; break; }
      const target = wall && this.world.entities.get(wall.entityId!);
      if (!target || (!target.barricade?.intact && target.kind !== 'physics-prop') || !this.specialHit(e.id, target.id)) break;
      this.world.combat!.damage.apply({ sourceId: e.id, targetId: target.id, attackId: a.attackId, actionId: a.move, origin: p, direction, base: elephant ? 400 : 300, multiplier: 1, type: 'melee', knockback: 0, stagger: 0, hitStopMs: 0 });
      distance = this.physicalClearDistance(e, direction, step);
    }
    if (elephant) this.elephantVehicles(e, direction, distance);
    const x = p.x, z = p.z;
    p.x += a.area.dx * Math.max(0, distance - (distance < step ? .001 : 0));
    p.z += a.area.dz * Math.max(0, distance - (distance < step ? .001 : 0));
    p.y = (this.world.districts?.pavingHeight(p.x, p.z) ?? 0) + .7 + (pounce && range > 0 ? Math.sin(Math.PI * Math.min(1, (travelled + distance) / range)) * .65 : 0);
    p.yaw = -Math.atan2(a.area.dz, a.area.dx); this.world.spatial.set(e.id, p.x, p.z);
    this.physicalQuery.x = x; this.physicalQuery.z = z; this.physicalQuery.r = distance + hitRadius + 1e-8;
    this.world.spatial.query(this.physicalQuery, this.physicalNeighbors);
    this.physicalOrigin.x = x; this.physicalOrigin.z = z;
    for (const id of this.physicalNeighbors) {
      const target = this.world.entities.get(id);
      if (!target || !this.physicalHuman(target) || pounce && target.id !== a.target.id) continue;
      const dx = target.transform.x - x, dz = target.transform.z - z;
      const along = Math.max(0, Math.min(distance, dx * a.area.dx + dz * a.area.dz));
      if (Math.hypot(dx - along * a.area.dx, dz - along * a.area.dz) <= hitRadius + 1e-8 && q.visible(this.physicalOrigin, target.transform) && this.physicalPropVisible(this.physicalOrigin, target.transform)) this.physicalHit(e, target, mega ? megaAlpha.moves['alpha.charge'].damage : zebra ? 25 : elephant ? 40 : 30);
      if (pounce && a.hitIds.includes(target.id)) {
        const b = e.infected!; b.grabUntil = this.world.tick + 90; b.grabHits = 0; b.heardTargetId = target.id; b.grabX = target.transform.x; b.grabZ = target.transform.z;
        this.finishSpecial(e.id); return;
      }
    }
    if (distance < step || travelled + step >= range - 1e-8) this.finishSpecial(e.id);
  }
  /** Existing flock steering drives actual birds; one leader owns the flock hit set. */
  private resolveFlockDive(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!, age = this.world.tick - a.activeTick;
    const leader = this.world.entities.get(a.leaderId ?? e.id), leaderAttack = leader?.infected?.specialAttack;
    if (!leader || leader.health.current <= 0 || !leaderAttack || leaderAttack.move !== 'flamingo.dive') { this.cancelSpecial(e.id); e.transform.y = .7; return; }
    const impactAge = leaderAttack.impactTick === undefined ? undefined : this.world.tick - leaderAttack.impactTick;
    if (age >= 180 || impactAge !== undefined && impactAge >= 24) { e.transform.y = (this.world.districts?.pavingHeight(e.transform.x, e.transform.z) ?? 0) + .7; this.finishSpecial(e.id); return; }
    steerFlockDive(e, a.area, age, this.world.tick, impactAge, a.members?.indexOf(e.id) ?? 0, this.world.combat!.query);
    this.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (a.leaderId !== e.id || age < 24 || a.impactTick !== undefined) return;
    const birds = (a.members ?? []).map(id => this.world.entities.get(id)).filter(member => member && member.health.current > 0 && member.infected?.specialAttack?.stage === 'active');
    if (!birds.length || !birds.some(member => Math.hypot(member!.transform.x - a.area.x, member!.transform.z - a.area.z) <= 3 && this.world.combat!.query.visible(member!.transform, a.area) && this.physicalPropVisible(member!.transform, a.area))) return;
    a.impactTick = this.world.tick;
    this.physicalQuery.x = a.area.x; this.physicalQuery.z = a.area.z; this.physicalQuery.r = 3 + 1e-8;
    this.world.spatial.query(this.physicalQuery, this.physicalNeighbors);
    for (const id of this.physicalNeighbors) {
      const target = this.world.entities.get(id);
      if (!target || !this.physicalHuman(target) || Math.hypot(target.transform.x - a.area.x, target.transform.z - a.area.z) > 3 + 1e-8 || !this.world.combat!.query.visible(a.area, target.transform) || !this.physicalPropVisible(a.area, target.transform) || !birds.some(member => this.world.combat!.query.visible(member!.transform, target.transform) && this.physicalPropVisible(member!.transform, target.transform))) continue;
      this.physicalHit(e, target, 5);
      if (target.id === 1) a.obstructionUntil = this.world.tick + 48;
    }
  }
  /** Swept chassis contact borrows E09's Rapier body; heavy/armored vehicles stay put. */
  private elephantVehicles(e: EntitySnapshot, direction: { x: number; z: number }, step: number): void {
    const a = e.infected!.specialAttack!, q = this.world.combat!.query;
    for (const car of this.world.vehicles?.cars.values() ?? []) {
      const { entity, physics } = car, p = entity.transform, def = physics.def;
      if (def.mass > 2000 || entity.health.current <= 0 || physics.body.isKinematic() || a.hitIds.includes(entity.id)) continue;
      // Transform the sweep into chassis space, then use the existing slab resolver.
      const c = Math.cos(p.yaw), s = Math.sin(p.yaw), dx = e.transform.x - p.x, dz = e.transform.z - p.z;
      const local = { x: dx * c - dz * s, z: dx * s + dz * c };
      const ray = { x: direction.x * c - direction.z * s, z: direction.x * s + direction.z * c };
      if (q.wallDistance({ x: 0, y: .7, z: 0, halfX: def.length / 2, halfY: 1, halfZ: def.width / 2 }, local, ray, step + 1e-8, 1.75) > step || !q.visible(e.transform, p) || !this.physicalPropVisible(e.transform, p) || !this.specialHit(e.id, entity.id)) continue;
      this.world.vehicles!.damage(entity.id, 80);
      // Eight m/s sideways clears parked tyre friction without teleporting the chassis.
      const side = local.z <= 0 ? 1 : -1;
      physics.body.applyImpulse({ x: s * def.mass * 8 * side, y: 0, z: c * def.mass * 8 * side }, true);
      this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: e.id, targetId: entity.id, attackId: a.attackId, special: a.move, amount: 80 });
    }
  }
  private physicalClearDistance(e: EntitySnapshot, direction: { x: number; z: number }, step: number): number {
    const q = this.world.combat!.query;
    const radius = e.infected?.pursuit ? megaAlpha.specialClearance : e.infected?.specialAttack?.move === 'elephant.charge' ? 1.75 : e.infected?.specialAttack?.move === 'zebra.stampede' ? .75 : e.combat!.radius;
    let distance = q.clearDistance(e.transform, direction, step, undefined, radius);
    for (const wall of this.world.props?.navWalls.values() ?? []) distance = Math.min(distance, q.wallDistance(wall, e.transform, direction, step, radius));
    return distance;
  }
  /** Reject a pose whose enlarged arm envelope intersects a solid wall/prop, including side/back cover. */
  private megaSpecialClear(e: EntitySnapshot): boolean {
    const p = e.transform, r = megaAlpha.specialClearance;
    const clear = (w: { x: number; z: number; y: number; halfX: number; halfZ: number; halfY: number }) =>
      w.y - w.halfY > 5.5 || w.y + w.halfY < .1 || Math.abs(p.x - w.x) > w.halfX + r || Math.abs(p.z - w.z) > w.halfZ + r;
    const q = this.world.combat!.query;
    return q.walls.every(clear) && q.dynamicWalls.every(clear) && [...(this.world.props?.navWalls.values() ?? [])].every(clear);
  }
  private releaseMegaGrab(a: import('./types').InfectedSpecialAttack): void {
    if (a.grabbedId === undefined) return;
    const target = this.world.entities.get(a.grabbedId);
    if (target?.survivor && target.survivor.knockdown?.until === a.grabReleaseTick) delete target.survivor.knockdown;
    if (target?.combat && target.combat.staggerUntil === a.grabReleaseTick) target.combat.staggerUntil = this.world.tick;
    delete a.grabbedId;
  }
  private resolveMegaGrab(e: EntitySnapshot): void {
    const a = e.infected!.specialAttack!, tick = this.world.tick;
    if (a.stage !== 'active') return;
    if (a.grabReleaseTick === undefined) {
      const target = this.world.entities.get(a.target.id);
      if (!target || !this.physicalHuman(target) || Math.hypot(target.transform.x - e.transform.x, target.transform.z - e.transform.z) > megaAlpha.moves['alpha.grab-throw'].radius || !this.world.combat!.query.visible(e.transform, target.transform) || !this.physicalPropVisible(e.transform, target.transform)) { this.finishSpecial(e.id); return; }
      this.physicalHit(e, target, megaAlpha.moves['alpha.grab-throw'].damage);
      a.grabbedId = target.id; a.grabReleaseTick = tick + megaAlpha.moves['alpha.grab-throw'].holdTicks;
      if (target.survivor) target.survivor.knockdown = { started: tick, until: a.grabReleaseTick };
      if (target.combat) target.combat.staggerUntil = a.grabReleaseTick;
    }
    if (tick >= a.grabReleaseTick) { this.releaseMegaGrab(a); this.finishSpecial(e.id); }
  }
  private physicalPropVisible(origin: { x: number; z: number }, target: { x: number; z: number }): boolean {
    const dx = target.x - origin.x, dz = target.z - origin.z, length = Math.hypot(dx, dz);
    if (!length) return true;
    for (const wall of this.world.props?.navWalls.values() ?? []) if (this.world.combat!.query.wallDistance(wall, origin, { x: dx / length, z: dz / length }, length) < length - 1e-8) return false;
    return true;
  }
  private physicalHuman(target: EntitySnapshot): boolean {
    return target.health.current > 0 && !target.hidden && !target.companion && !target.escort?.child && !(target.civilian && (!target.civilian.adult || (target.civilian.pet && !target.civilian.zooAnimal) || ['finished', 'infected', 'down', 'rising'].includes(target.civilian.state))) && !storyProtected(this.world, target) && (target.kind === 'player' || target.faction === 'civilian' || target.faction === 'escort' || !!target.civilian);
  }
  private physicalHit(source: EntitySnapshot, target: EntitySnapshot, base: number): void {
    if (!this.specialHit(source.id, target.id)) return;
    const a = source.infected!.specialAttack!;
    const dx = target.transform.x - source.transform.x, dz = target.transform.z - source.transform.z, length = Math.hypot(dx, dz);
    const amount = this.world.combat!.damage.apply({ sourceId: source.id, targetId: target.id, attackId: a.attackId, actionId: a.move.startsWith('alpha.') ? a.move : `infected.${a.move}`, origin: source.transform, direction: length ? { x: dx / length, z: dz / length } : { x: a.area.dx, z: a.area.dz }, base, multiplier: 1, type: 'melee', knockback: a.move === 'elephant.swipe' || a.move === 'zebra.kick' ? 3 : 0, stagger: a.move === 'zebra.kick' || a.move === 'flamingo.dive' ? .6 : 0, knockdownTicks: a.move === 'zebra.kick' || a.move === 'flamingo.dive' ? 0 : a.move === 'zebra.stampede' ? 60 : a.move === 'elephant.charge' ? 90 : a.move === 'elephant.swipe' ? 48 : a.move === 'lion.pounce' ? target.kind === 'player' ? 0 : 90 : 72, hitStopMs: 0 });
    this.world.events.emit({ type: 'infected.attack', tick: this.world.tick, sourceId: source.id, targetId: target.id, attackId: a.attackId, special: a.move, amount });
  }
  /** Stable test/debug surface, including RNG and pool/director counters needed for deterministic replay. */
  snapshot() {
    return { sequence: this.sequence, specials: this.active.filter(e => e.infected!.specialAttack || e.infected!.specialCooldowns).map(e => ({ sourceId: e.id, attack: structuredClone(e.infected!.specialAttack), cooldowns: { ...e.infected!.specialCooldowns }, recoveryUntil: e.infected!.specialRecoveryUntil ?? 0 })), rng: this.rng.snapshot(), pool: { ...this.counters, available: this.pool.length }, cap: this.director.cap, count: this.director.count, queued: this.director.queue.map((q) => ({ archetype: q.archetype, position: q.position, options: q.options, turning: q.turning ?? false })), migrations: this.director.migrations.map((m) => ({ started: m.started, arrived: m.arrived, expectedSeconds: m.expectedSeconds, members: m.members })) };
  }
  /** E26 uses the same authored attack damage when resolving barricades. */
  barricadeDamage(sourceId: number, base: number): number { return this.world.entities.get(sourceId)?.archetype === 'infected.alpha' ? 100 : base * (this.world.entities.get(sourceId)?.archetype === 'infected.gorilla' ? 6 : this.world.entities.get(sourceId)?.archetype === 'infected.brute' ? 5 : this.world.entities.get(sourceId)?.archetype === 'infected.butcher' ? 8 : 1); }
  /**
   * L1 steering under the motion limits: straight when the goal is in clear view (re-checked every 6 ticks or when the
   * goal moved), else a budgeted A* route (at most 4 new routes per tick; moving goals re-route every 0.25 s), or the
   * shared flow field when chasing the survivor in a crowd. `pursue` keeps full speed onto a moving human.
   */
  private readonly ringPoint = { x: 0, z: 0 };
  /** The courier moved less than 1 m/s this tick. */
  private courierStill(): boolean { const p = this.world.entities.get(1)?.transform, q = this.world.previousPlayer; return !!p && !!q && Math.hypot(p.x - q.x, p.z - q.z) * 60 < 1; }
  private steerL1(e: EntitySnapshot, brain: L1Brain, goal: { x: number; z: number }, speed: number, survivor = false, pursue = false): void {
    speed = this.l3Speed(e, speed);
    const b = e.infected!, tick = this.world.tick, radius = e.combat!.radius, grid = this.navigation.district(e.transform);
    if (b.pathGrid !== grid) { b.pathGrid = grid; b.goal = -1; b.path.length = 0; }
    const nav = this.navigation.grid(e.transform);
    if ((brain.escapeUntil ?? 0) > tick) {
      // Leaving a nav pocket: walk straight to the open cell found outside it, then route normally.
      const ex = brain.escapeX! - e.transform.x, ez = brain.escapeZ! - e.transform.z, d = Math.hypot(ex, ez);
      if (d > 0.15) { const v = Math.min(Math.max(speed, 1), d * 4); moveAgent(e, ex / d * v, ez / d * v, this.infectedNav, tick); return; }
      brain.escapeUntil = 0; brain.directTick = -1; b.path.length = 0; b.goal = -1;
    }
    const target = this.navigation.target(e.transform, goal);
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
        if (stale && this.budget > 0 && this.routes < 4 && tick >= (brain.routeAt ?? 0)) {
          this.routes++;
          const start = nav.startCell(e.transform, radius * 0.6), found = start >= 0 && nav.path(start, to, b.path, this.budget);
          this.budget -= start >= 0 ? nav.expansions : 0; b.pathIndex = 0; b.goal = to;
          // Unfinished/empty requests wait before retrying so later agents get a route slot.
          if (!found || b.path.length < 2) brain.routeAt = tick + 15;
          if (!found && (start < 0 || !nav.pending(start, to))) { this.noRoute(e, brain, nav, survivor, start < 0); if ((brain.escapeUntil ?? 0) > tick) return; }
        }
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
    const velocity = Math.min(speed, remaining * (pursue ? 60 : 2)); moveAgent(e, dx / distance * velocity, dz / distance * velocity, this.infectedNav, tick);
    if (velocity > 0.5) this.watchStuck(e, brain);
  }
  /**
   * PO-QA #12: an infected pressing against a fence (no route, nav pocket) makes no progress. After 1.5 s without
   * progress it gives up: a chased human is ignored for 6 s (search/wander instead), a probe or wander goal is dropped.
   */
  private watchStuck(e: EntitySnapshot, brain: L1Brain): void {
    const tick = this.world.tick;
    if (tick - brain.stuckTick < 45) return;
    if (tick - brain.stuckTick > 90) { brain.stuckTick = tick; brain.stuckX = e.transform.x; brain.stuckZ = e.transform.z; brain.stuckCount = 0; return; } // was standing: fresh window
    const moved = Math.hypot(e.transform.x - brain.stuckX, e.transform.z - brain.stuckZ);
    brain.stuckTick = tick; brain.stuckX = e.transform.x; brain.stuckZ = e.transform.z;
    brain.stuckCount = moved < 0.35 ? brain.stuckCount + 1 : 0;
    if (brain.stuckCount < 2) return;
    brain.stuckCount = 0; this.giveUp(e, brain);
    // A starved route can leave every successive search probe behind the same fence.
    // First walk to a clear nearby point, using the existing pocket escape, before trying the next goal.
    const nav = this.navigation.grid(e.transform), cell = nav.escapeCell(e.transform, e.combat!.radius, 6, false, 1.5);
    if (cell >= 0) { brain.escapeX = nav.x(cell); brain.escapeZ = nav.z(cell); brain.escapeUntil = tick + 120; }
  }
  /**
   * The current goal has no route (A* exhausted its component): back off new route requests for ~0.5 s so the shared
   * per-tick budget serves the others, then walk out of a nav pocket if the body stands in one, or give the goal up
   * (wander/search/attracted pick another; a chase keeps steering straight at the human and `watchStuck` decides).
   */
  private noRoute(e: EntitySnapshot, brain: L1Brain, nav: NavGrid, survivor: boolean, slot: boolean): void {
    const tick = this.world.tick;
    brain.routeAt = tick + 30 + e.id % 15;
    if (slot || nav.searchSize < 400) {
      // A body pressed against the gap posts still walks out (60 % radius for the reach test).
      const cell = nav.escapeCell(e.transform, e.combat!.radius * 0.6, slot ? 8 : 6, !slot);
      if (cell >= 0) { brain.escapeX = nav.x(cell); brain.escapeZ = nav.z(cell); brain.escapeUntil = tick + 120; return; }
    }
    if (!survivor && brain.mode !== 'chase') this.giveUp(e, brain);
  }
  private giveUp(e: EntitySnapshot, brain: L1Brain): void {
    const tick = this.world.tick;
    e.infected!.path.length = 0; e.infected!.goal = -1; brain.directTick = -1;
    if (brain.mode === 'chase') {
      brain.ignoreId = brain.targetId; brain.ignoreUntil = tick + l1Ticks(6);
      this.startSearch(e.infected!, brain, { x: e.transform.x, z: e.transform.z }, { x: 0, z: 0 });
    } else if (brain.mode === 'search') { brain.search.next++; brain.search.legTicks = 0; }
    else if (brain.mode === 'attracted') {
      // Blocked short of the sound (e.g. against the alarmed car): search around the source until the attraction ends,
      // as on arrival, rather than a fresh 10-18 s search that could end while the alarm still sounds.
      const plan = brain.search;
      planSearch(plan, this.l1Rng!, this.infectedNav, tick, { x: plan.originX, z: plan.originZ }, { x: 0, z: 0 }, Math.max(1, plan.until - tick), [3, 7]);
      plan.next = 0; brain.mode = 'search'; e.infected!.state = 'attracted';
    }
    else { brain.hasGoal = false; brain.looking = true; brain.lookYaw = e.transform.yaw + Math.PI * 0.7; brain.pauseUntil = tick + 20; }
  }
  private seek(e: EntitySnapshot, target: { x: number; z: number }, specialSpeed?: number): void {
    const grid = this.navigation.district(e.transform), b = e.infected!;
    if (b.pathGrid !== grid) { b.pathGrid = grid; b.goal = -1; b.path.length = 0; }
    const nav = this.navigation.grid(e.transform); target = this.navigation.target(e.transform, target);
    let x = target.x, z = target.z;
    // Only a courier chase can share its flow field; soldier and investigation goals need their own route.
    const useFlow = this.active.length > 20 && !b.roar && !b.specialAttack && !b.scripted && !b.investigate && (b.heardTargetId ?? 1) <= 1;
    if (!nav.visible(e.transform, target, e.combat!.radius)) {
      // Clear paths steer directly; cell searches are needed only around cover.
      const from = nav.nearestCell(e.transform.x, e.transform.z), to = nav.nearestCell(x, z);
      let next = from;
      if (useFlow) next = nav.flowNext(from);
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
      if (next < 0 || (useFlow && next === from)) return;
      x = nav.x(next); z = nav.z(next);
    }
    const dx = x - e.transform.x, dz = z - e.transform.z, distance = Math.hypot(dx, dz);
    const remaining = x === target.x && z === target.z ? distance - e.combat!.radius - 0.36 : distance;
    if (remaining < 0.02) return;
    const speed = Math.min((specialSpeed ?? b.speed) * (b.roar && this.world.tick < b.roar.until ? (b.roar.speedUntil === undefined || this.world.tick < b.roar.speedUntil ? b.roar.speedScale ?? 1.25 : 1) : 1), remaining * (specialSpeed === undefined ? 2 : 60)); moveAgent(e, dx / distance * speed, dz / distance * speed, this.infectedNav, this.world.tick, e.combat!.radius, specialSpeed !== undefined);
  }
}
