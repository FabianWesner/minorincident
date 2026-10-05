import { InfectedSystem } from '../ai/InfectedSystem';
import { Combat } from '../combat/Combat';
import { Status } from '../combat/Status';
import { Player } from '../entities/Player';
import { EventBus, SimPhase } from '../../core/EventBus';
import { Rng } from '../../core/Rng';
import type { Lifecycle } from '../../core/Lifecycle';
import { loadScenarioDefinition } from '../../levels/loader';
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
  player: Player | null = null;
  combat: Combat | null = null;
  infected: InfectedSystem | null = null;
  /** Level-owned records survive player death; scenario unload clears them. */
  mission: GameStateSnapshot['mission'] = null;
  progression: GameStateSnapshot['progression'] = null;
  tick = 0;
  seed = 1;
  scenario: string | null = null;
  previousPlayer: Transform | null = null;
  private input = emptyInput();
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
    if (definition.combat) this.combat = new Combat(this, definition);
    this.events.on('sim.tick', () => { if (this.combat) this.combat.intent(this.input); }, SimPhase.input);
    this.events.on('sim.tick', () => {
      const body = this.physics.playerBody!;
      const player = this.entities.get(1)!;
      if (this.player) { Object.assign(this.previousPlayer!, player.transform); this.player.locomotion.speedScale = Status.speed(player) * (this.infected?.playerSpeedScale() ?? 1); this.player.prePhysics(this.input, this.tick, !Status.stunned(player, this.tick) && !(this.infected?.playerPinned() ?? false)); return; }
      this.previousPlayer = { ...player.transform };
      // Deliberately only a cube input fixture, no survivor controller (E04).
      body.setLinvel({ x: this.input.move.x * 5, y: body.linvel().y, z: this.input.move.z * 5 }, true);
    }, SimPhase.intent);
    if (definition.infected) { this.infected = new InfectedSystem(this, definition); this.events.on('sim.tick', () => this.infected!.update(), SimPhase.ai); }
    this.events.on('sim.tick', () => this.physics.update(), SimPhase.physics);
    this.events.on('sim.tick', () => {
      if (this.combat) {
        const position = this.physics.playerBody!.translation(); Object.assign(this.entities.get(1)!.transform, position); this.spatial.set(1, position.x, position.z);
        this.infected?.props.update();
        this.combat.update(this.input);
      }
    }, SimPhase.combat);
    this.events.on('sim.tick', () => {
      if (this.player) { this.player.postPhysics(this.tick); this.spatial.set(1, this.player.entity.transform.x, this.player.entity.transform.z); return; }
      const p = this.physics.playerBody!.translation();
      Object.assign(this.entities.get(1)!.transform, p);
      this.spatial.set(1, p.x, p.z);
    }, SimPhase.cleanup);
    this.events.emit({ tick: 0, type: 'scenario.loaded', name, seed });
  }
  setInput(patch: Partial<InputFrame>): void {
    const next = { ...this.input, ...structuredClone(patch) };
    for (const vector of [next.move, next.aim, next.aimPoint]) if (vector && (!Number.isFinite(vector.x) || !Number.isFinite(vector.z))) throw new RangeError('Input vectors must be finite');
    this.input = next;
  }
  /** Device frames are borrowed for this tick; snapshots are independently copied. */
  applyInput(frame: InputFrame, scheme: import('../../input/InputFrame').Scheme): void { this.input = frame; this.scheme = scheme; }
  clearInput(): void { this.input = emptyInput(); this.scheme = 'mouse-only'; }
  update(): void { if (this.scenario) this.events.emit({ type: 'sim.tick', tick: ++this.tick }); }
  getEntity(id: number): EntitySnapshot | null { return structuredClone(this.entities.get(id) ?? null); }
  query(filter: EntityFilter): EntitySnapshot[] {
    const nearby = filter.within ? new Set(this.spatial.query(filter.within)) : null;
    return structuredClone(this.entities.values().filter((e) => (!filter.detectable || !e.infected?.hidden) && (!filter.kind || e.kind === filter.kind) && (!filter.archetype || e.archetype === filter.archetype) && (!nearby || nearby.has(e.id))));
  }
  getState(): GameStateSnapshot {
    return { ...(this.combat ? { combat: structuredClone(this.combat.snapshot()) } : {}), tick: this.tick, input: { scheme: this.scheme, frame: structuredClone(this.input) }, seed: this.seed, scenario: this.scenario, player: this.getEntity(1), entities: this.query({}), mission: structuredClone(this.mission), progression: structuredClone(this.progression), rng: this.rng ? [this.rng.snapshot()] : [], perf: { entities: this.entities.size, bodies: this.physics.bodyCount, colliders: this.physics.colliderCount, listeners: this.events.listenerCount } };
  }
  spawnDummy(archetype: string, pos: { x: number; z: number }, opts: { hp?: number; armor?: number; yaw?: number; shield?: boolean; faction?: string; radius?: number } = {}): number {
    if (!this.combat) throw new Error('Load combat-arena before spawning dummies');
    const hp = opts.hp ?? 100, armor = opts.armor ?? 0, yaw = opts.yaw ?? 0, radius = opts.radius ?? 0.4;
    if (![pos.x, pos.z, hp, armor, yaw, radius].every(Number.isFinite) || hp <= 0 || armor < 0 || armor > 1 || radius <= 0) throw new RangeError('Invalid dummy');
    const entity = this.entities.create({ kind: opts.faction === 'escort' ? 'escort' : 'infected', archetype, transform: { ...pos, y: 0.7, yaw }, health: { current: hp, max: hp }, faction: opts.faction ?? 'infected', combat: { radius, armor, shield: opts.shield ?? archetype === 'infected.riot', staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } });
    this.spatial.set(entity.id, pos.x, pos.z); return entity.id;
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
    this.mission = null; this.progression = null; this.infected = null; this.combat = null; this.player = null; this.physics.reset(); this.entities.reset(); this.spatial.reset(); this.events.reset();
    this.tick = 0; this.scenario = null; this.previousPlayer = null; this.rng = null; this.clearInput();
  }
  dispose(): void { this.reset(); }
}
