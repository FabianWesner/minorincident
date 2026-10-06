import { ControlIntent } from '../entities/ControlIntent';
import { installCampaignNpcs, rebuildNpcNavigation } from '../npc/install';
import { Npcs } from '../npc/Npcs';
import { populateHorde } from '../../../tests/fixtures/scenarios/performance';
import { InfectedSystem } from '../ai/InfectedSystem';
import { Mission } from '../missions/Mission';
import type { MissionDef } from '../missions/types';
import { Vehicles } from '../vehicles/Vehicles';
import { installVfxScenario } from '../../../tests/fixtures/scenarios/vfx';
import { survivor } from '../../data/survivor';
import { Combat } from '../combat/Combat';
import { Interactables } from '../interact/Interactables';
import { Hazards } from '../interact/Hazards';
import { Pickups } from '../interact/Pickups';
import { Status } from '../combat/Status';
import { Player } from '../entities/Player';
import { EventBus, SimPhase } from '../../core/EventBus';
import { Rng } from '../../core/Rng';
import type { Lifecycle } from '../../core/Lifecycle';
import { DistrictWorld } from './DistrictWorld';
import type { DistrictLayout, LevelComposition } from '../../levels/districts/types';
import { loadScenarioDefinition, type InteractionPlacements } from '../../levels/loader';
import { Physics } from '../../physics/Physics';
import { SpatialHash } from '../spatial/SpatialHash';
import { EntityStore } from './EntityStore';
import { emptyInput, type EntityFilter, type EntitySnapshot, type GameEvent, type GameStateSnapshot, type InputFrame, type Transform } from './types';

/** Headless composition root: survivor gameplay and the preserved E01/E02 cube fixtures. */
export class SimWorld implements Lifecycle {
  readonly physics = new Physics();
  readonly events = new EventBus<GameEvent>();
  readonly entities = new EntityStore();
  readonly spatial = new SpatialHash();
  districts: DistrictWorld | null = null;
  player: Player | null = null;
  combat: Combat | null = null;
  infected: InfectedSystem | null = null;
  npcs: Npcs | null = null;
  interactables: Interactables | null = null;
  hazards: Hazards | null = null;
  pickups: Pickups | null = null;
  missions: Mission | null = null;
  get inputFrame(): InputFrame { return this.effectiveInput; }
  /** Attach a validated mission after scenario/composition assembly. */
  loadMission(def: MissionDef): Mission { const next=new Mission(this,def);this.missions?.dispose();return this.missions=next; }
  vehicles: Vehicles | null = null;
  /** Level-owned records survive player death; scenario unload clears them. */
  mission: GameStateSnapshot['mission'] = null;
  progression: GameStateSnapshot['progression'] = null;
  tick = 0;
  seed = 1;
  scenario: string | null = null;
  previousPlayer: Transform | null = null;
  readonly controls = new ControlIntent(this);
  private effectiveInput = emptyInput();
  private input = emptyInput();
  private readonly drivingCombatInput = emptyInput();
  private scheme: import('../../input/InputFrame').Scheme = 'mouse-only';
  private rng: Rng | null = null;
  async init(): Promise<void> { await this.physics.init(); }
  loadScenario(name: string, seed = 1): void {
    const definition = loadScenarioDefinition(name);
    if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
    this.reset(); this.seed = seed; this.scenario = name;
    this.rng = new Rng(seed, 'fixture');
    this.physics.load(definition);
    this.entities.create({ kind: 'player', archetype: definition.survivor ? 'player.survivor' : 'player.stub', transform: { ...definition.player, yaw: this.rng.next() * Math.PI * 2 }, health: { current: 100, max: 100 }, faction: 'survivor' });
    if (definition.survivor) this.player = new Player(this.entities.get(1)!, this.physics, this.events);
    this.previousPlayer = { ...this.entities.get(1)!.transform };
    this.spatial.set(1, definition.player.x, definition.player.z);
    if (this.player) this.interactables = new Interactables(this);
    if (definition.combat) this.combat = new Combat(this, definition);
    if (this.player) this.hazards = new Hazards(this);
    if (this.player) this.pickups = new Pickups(this);
    if (definition.survivor) this.vehicles = new Vehicles(this);
    if (name === 'drive-course') {
      this.vehicles!.spawn('vehicle.sedan', { x: 0, z: 0 }); this.vehicles!.spawn('vehicle.police', { x: 0, z: 12 });
      for (let x = 25; x <= 575; x += 25) { const z = Math.sin(x / 40) * 3; this.vehicles!.obstacles.spawn('cone', { x, z: z - 2 }); this.vehicles!.obstacles.spawn('cone', { x, z: z + 2 }); }
    }
    this.events.on('sim.tick', () => { this.effectiveInput = this.controls.resolve(this.input); }, SimPhase.input);
    this.events.on('sim.tick', () => this.vehicles?.prePhysics(this.effectiveInput, this.scheme), SimPhase.input);
    this.events.on('sim.tick', () => { if (this.combat && this.vehicles?.active == null) this.combat.intent(this.effectiveInput); }, SimPhase.input);
    this.events.on('sim.tick', () => {
      const body = this.physics.playerBody!;
      const player = this.entities.get(1)!;
      if (this.vehicles?.active != null) return;
      if (this.player) { Object.assign(this.previousPlayer!, player.transform); this.player.locomotion.speedScale = this.player.progressionSpeed * Status.speed(player) * (this.combat?.effects.speedMultiplier ?? 1) * (this.infected?.playerSpeedScale() ?? 1) * (player.speedBuff && this.tick < player.speedBuff.until ? player.speedBuff.multiplier : 1); this.player.prePhysics(this.effectiveInput, this.tick, !Status.stunned(player, this.tick) && !(this.infected?.playerPinned() ?? false)); return; }
      this.previousPlayer = { ...player.transform };
      // Deliberately only a cube input fixture, no survivor controller (E04).
      body.setLinvel({ x: this.effectiveInput.move.x * 5, y: body.linvel().y, z: this.effectiveInput.move.z * 5 }, true);
    }, SimPhase.intent);
    this.events.on('sim.tick', () => this.combat?.effects.moveListeners(), SimPhase.ai);
    if (definition.infected) { this.infected = new InfectedSystem(this, definition); this.events.on('sim.tick', () => this.infected!.update(), SimPhase.ai); }
    if (definition.infected) { this.npcs = new Npcs(this); this.events.on('sim.tick', () => this.npcs?.update(), SimPhase.ai); if (definition.npcs) { this.npcs.configure(definition.npcs.level ?? 1, definition.npcs.tier, definition.npcs.ambient); if (definition.npcs.companion) this.npcs.companion.spawn(); } }
    this.placeInteractions(definition);
    this.events.on('sim.tick', () => this.physics.update(), SimPhase.physics);
    this.events.on('sim.tick', () => {
      this.vehicles?.postPhysics();
      if (this.combat) {
        const position = this.physics.playerBody!.translation(); Object.assign(this.entities.get(1)!.transform, position); this.spatial.set(1, position.x, position.z);
        this.infected?.props.update();
        this.combat.update(this.vehicles?.active != null ? this.drivingCombatInput : this.effectiveInput);
      }
    }, SimPhase.combat);
    this.events.on('sim.tick', () => {
      if (this.player) Object.assign(this.player.entity.transform, this.physics.playerBody!.translation());
      this.hazards?.update(); this.pickups?.update(); this.interactables?.update(this.effectiveInput);
    }, SimPhase.missions);
    this.events.on('sim.tick', () => {
      if (this.vehicles?.active != null) return;
      if (this.player) { this.player.postPhysics(this.tick); this.spatial.set(1, this.player.entity.transform.x, this.player.entity.transform.z); return; }
      const p = this.physics.playerBody!.translation();
      Object.assign(this.entities.get(1)!.transform, p);
      this.spatial.set(1, p.x, p.z);
    }, SimPhase.cleanup);
    installVfxScenario(this);
    if (name === 'perf-horde-200' || name === 'perf-horde-100') {
      this.infected!.director.tier = name === 'perf-horde-100' ? 'low' : 'high'; populateHorde(this, name === 'perf-horde-100' ? 100 : 200);
    }
    this.events.emit({ tick: 0, type: 'scenario.loaded', name, seed });
  }
  /** E10 composition hook; missions/controllers continue to use their existing scenario lifecycle. */
  loadComposition(composition:LevelComposition, layouts:DistrictLayout[], seed=1):void {
    const districts=new DistrictWorld(composition,layouts,seed);
    this.loadScenario('survivor',seed);this.scenario=composition.id;this.districts=districts;
    this.player!.locomotion.groundHeight = (x, z) => this.districts?.groundHeight(x, z) ?? 0;
    this.interactables!.nav = districts.nav;
    const {min,max}=districts.nav;
    this.physics.load({name:composition.id,survivor:true,ground:{width:max[0]-min[0],depth:max[1]-min[1],center:{x:(min[0]+max[0])/2,z:(min[1]+max[1])/2}},player:{x:districts.playerStart[0],y:survivor.height/2+.005,z:districts.playerStart[1]}});
    Object.assign(this.entities.get(1)!.transform,{x:districts.playerStart[0],y:survivor.height/2+.005,z:districts.playerStart[1]});this.previousPlayer={...this.entities.get(1)!.transform};this.player!.setCheckpoint(this.entities.get(1)!.transform);this.spatial.set(1,districts.playerStart[0],districts.playerStart[1]);
    for(const d of districts.districts)for(const aabb of d.decay.colliders.map((c)=>c.aabb).concat(d.blockers))this.physics.addStatic(aabb,d.origin);
    for (const boundary of districts.boundaries) this.physics.addStatic(boundary, [0, 0]);
    this.physics.world!.step();
    for (const d of districts.districts) {
      this.placeInteractions(d.gameplay.interactions ?? {}, d.origin);
    }
    installCampaignNpcs(this);
    this.events.on('sim.tick',()=>{
      if(this.tick%60!==0)return;
      const player=this.entities.get(1)!;
      for(const fire of this.districts!.fires)if((player.transform.x-fire.x)**2+(player.transform.z-fire.z)**2<=fire.radius**2)this.player!.damage(fire.damagePerSecond,this.tick);
    },SimPhase.combat);
  }
  /** Scripted encounters use the loaded town colliders, never the fixture arena grid. */
  enableInfected(): void {
    if (this.infected || !this.districts) return;
    const { min, max } = this.districts.nav;
    const walls = this.districts.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable).map(c => c.aabb).concat(d.blockers).map(a => ({
      y: (a.min[1]+a.max[1])/2, halfY: (a.max[1]-a.min[1])/2, x: (a.min[0]+a.max[0])/2+d.origin[0], z: (a.min[2]+a.max[2])/2+d.origin[1], halfX: (a.max[0]-a.min[0])/2, halfZ: (a.max[2]-a.min[2])/2,
    })));
    if (this.combat) (this.combat.query.walls as import('../combat/HitQuery').CoverWall[]).push(...walls);
    this.infected = new InfectedSystem(this, { name:'L1', infected:true, ground:{width:max[0]-min[0],depth:max[1]-min[1],center:{x:(min[0]+max[0])/2,z:(min[1]+max[1])/2}}, player:this.entities.get(1)!.transform, walls });
    this.infected.director.levelCap = 15;
    this.events.on('sim.tick', () => this.infected!.update(), SimPhase.ai);
  }
  /** Mission script integration: rebuild decay collision/nav once on a tier change. */
  setTier(tier: 0|1|2|3|4|5): void {
    const previous = this.districts; if (!previous || previous.composition.tier === tier) return;
    const next = new DistrictWorld({...previous.composition,tier},previous.districts.map(d=>d.layout),this.seed);
    this.districts = next;
    const {min,max}=next.nav, player=this.entities.get(1)!;
    this.physics.load({name:next.composition.id,survivor:true,ground:{width:max[0]-min[0],depth:max[1]-min[1],center:{x:(min[0]+max[0])/2,z:(min[1]+max[1])/2}},player:player.transform});
    for(const d of next.districts)for(const aabb of d.decay.colliders.map(c=>c.aabb).concat(d.blockers))this.physics.addStatic(aabb,d.origin);
    for (const boundary of next.boundaries) this.physics.addStatic(boundary, [0, 0]);
    this.vehicles?.rebuild(true);
    this.hazards?.debris.reset(true); this.interactables?.rebuildBlockers(next.nav, true);
    this.missions?.rebuildGates(); this.player!.locomotion.reset(); this.physics.world!.step(); rebuildNpcNavigation(this);
  }
  setInput(patch: Partial<InputFrame>): void {
    const next = { ...this.input, ...structuredClone(patch) };
    for (const vector of [next.move, next.aim, next.aimPoint, next.moveTarget]) if (vector && (!Number.isFinite(vector.x) || !Number.isFinite(vector.z))) throw new RangeError('Input vectors must be finite');
    this.input = next;
  }
  /** World-space E11 gameplay placements. Static Blender geometry remains owned by E10. */
  private placeInteractions(data: InteractionPlacements, origin: [number, number] = [0, 0]): void {
    const pos = (p: { x: number; z: number }) => ({ x: p.x + origin[0], z: p.z + origin[1] });
    for (const d of data.devices ?? []) this.interactables!.spawn(d.kind, pos(d.position), d.options);
    for (const h of data.hazards ?? []) this.hazards!.spawn(h.kind, pos(h.position), h.options);
    for (const p of data.pickups ?? []) this.pickups!.spawn(p.kind, pos(p.position), p.item);
  }
  /** Device frames are borrowed for this tick; snapshots are independently copied. */
  applyInput(frame: InputFrame, scheme: import('../../input/InputFrame').Scheme): void { this.input = frame; this.scheme = scheme; }
  clearInput(): void { this.controls.reset(); this.effectiveInput = emptyInput(); this.input = emptyInput(); this.scheme = 'mouse-only'; }
  update(): void {
    if (!this.scenario) return;
    if (this.missions?.state.phase === 'cinematic') { this.missions.advanceCinematic(this.input); return; }
    if (this.missions && this.missions.state.phase !== 'playing') return;
    this.events.emit({ type: 'sim.tick', tick: ++this.tick });
  }
  getEntity(id: number): EntitySnapshot | null { return structuredClone(this.entities.get(id) ?? null); }
  query(filter: EntityFilter): EntitySnapshot[] {
    const nearby = filter.within ? new Set(this.spatial.query(filter.within)) : null;
    return structuredClone(this.entities.values().filter((e) => (!filter.detectable || !e.infected?.hidden) && (!filter.kind || e.kind === filter.kind) && (!filter.archetype || e.archetype === filter.archetype) && (!nearby || nearby.has(e.id))));
  }
  getState(): GameStateSnapshot {
    const entities = this.query({});
    const controls = this.controls.snapshot();
    return { ...(controls ? { controls } : {}), ...(this.infected ? { ai: structuredClone(this.infected.snapshot()) } : {}), ...(entities.some(e => e.interactable || e.hazard || (e.pickup && 'kind' in e.pickup) || e.destructible) ? { interactions: { activeId: this.interactables?.activeId ?? null, debris: this.hazards?.debris.snapshot() ?? [], hazards: this.hazards?.snapshot() ?? null } } : {}), ...(this.combat ? { combat: structuredClone(this.combat.snapshot()) } : {}), tick: this.tick, input: { scheme: this.scheme, frame: structuredClone(this.input) }, seed: this.seed, scenario: this.scenario, player: this.getEntity(1), entities, mission: structuredClone(this.mission), progression: structuredClone(this.progression), rng: this.rng ? [this.rng.snapshot()] : [], perf: { entities: this.entities.size, bodies: this.physics.bodyCount, colliders: this.physics.colliderCount, listeners: this.events.listenerCount } };
  }
  spawnDummy(archetype: string, pos: { x: number; z: number }, opts: { hp?: number; armor?: number; yaw?: number; shield?: boolean; faction?: string; radius?: number; reactive?: boolean; ramDamage?: number } = {}): number {
    if (!this.combat) throw new Error('Load combat-arena before spawning dummies');
    const hp = opts.hp ?? 100, armor = opts.armor ?? 0, yaw = opts.yaw ?? 0, radius = opts.radius ?? 0.4;
    if (![pos.x, pos.z, hp, armor, yaw, radius].every(Number.isFinite) || hp <= 0 || armor < 0 || armor > 1 || radius <= 0) throw new RangeError('Invalid dummy');
    const entity = this.entities.create({ kind: opts.faction === 'escort' ? 'escort' : 'infected', archetype, transform: { ...pos, y: 0.7, yaw }, health: { current: hp, max: hp }, faction: opts.faction ?? 'infected', combat: { radius, armor, shield: opts.shield ?? archetype === 'infected.riot', staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } });
    if (opts.ramDamage !== undefined) entity.ramDamage = opts.ramDamage;
    if (opts.reactive && entity.faction === 'infected') entity.hearing = { mode: 'idle', target: { x: pos.x, z: pos.z }, lureUntil: 0 };
    this.spatial.set(entity.id, pos.x, pos.z); this.events.emit({ type: 'entity.spawned', tick: this.tick, id: entity.id }); return entity.id;
  }
  /** E05 impulse is the authored displacement in metres, swept against full cover. */
  knockback(entity: EntitySnapshot, direction: { x: number; z: number }, impulse: number): void {
    const distance = this.combat!.query.clearDistance(entity.transform, direction, impulse + (entity.combat?.radius ?? 0.4));
    const move = Math.max(0, Math.min(impulse, distance - (entity.combat?.radius ?? 0.4)));
    entity.transform.x += direction.x * move; entity.transform.z += direction.z * move;
    this.spatial.set(entity.id, entity.transform.x, entity.transform.z);
    if (entity.id === 1) this.physics.playerBody!.setTranslation(entity.transform, true);
  }
  reset(): void {
    this.vehicles?.dispose(); this.vehicles = null;
    this.missions?.dispose(); this.missions = null; this.mission = null; this.progression = null; this.infected = null; this.npcs = null; this.pickups = null; this.hazards = null; this.interactables = null; this.combat = null; this.player = null; this.physics.reset(); this.entities.reset(); this.spatial.reset(); this.events.reset();
    this.tick = 0; this.districts = null; this.scenario = null; this.previousPlayer = null; this.rng = null; this.clearInput();
  }
  dispose(): void { this.reset(); }
}
