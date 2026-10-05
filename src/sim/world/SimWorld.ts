import { EventBus, SimPhase } from '../../core/EventBus';
import { Rng } from '../../core/Rng';
import type { Lifecycle } from '../../core/Lifecycle';
import { loadScenarioDefinition } from '../../levels/loader';
import { Physics } from '../../physics/Physics';
import { SpatialHash } from '../spatial/SpatialHash';
import { EntityStore } from './EntityStore';
import { emptyInput, type EntityFilter, type EntitySnapshot, type GameEvent, type GameStateSnapshot, type InputFrame, type Transform } from './types';

/** Headless composition root; movement here is only a controllable E01 fixture stub. */
export class SimWorld implements Lifecycle {
  readonly physics = new Physics();
  readonly events = new EventBus<GameEvent>();
  readonly entities = new EntityStore();
  readonly spatial = new SpatialHash();
  tick = 0;
  seed = 1;
  scenario: string | null = null;
  previousPlayer: Transform | null = null;
  private input = emptyInput();
  private rng: Rng | null = null;
  async init(): Promise<void> { await this.physics.init(); }
  loadScenario(name: string, seed = 1): void {
    const definition = loadScenarioDefinition(name);
    if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
    this.reset(); this.seed = seed; this.scenario = name;
    this.rng = new Rng(seed, 'fixture');
    this.physics.load(definition);
    this.entities.create({ kind: 'player', archetype: 'player.stub', transform: { ...definition.player, yaw: this.rng.next() * Math.PI * 2 }, health: { current: 100, max: 100 }, faction: 'survivor' });
    this.previousPlayer = { ...this.entities.get(1)!.transform };
    this.spatial.set(1, definition.player.x, definition.player.z);
    this.events.on('sim.tick', () => {
      const body = this.physics.playerBody!;
      const player = this.entities.get(1)!;
      this.previousPlayer = { ...player.transform };
      // Deliberately only a cube input fixture, no survivor controller (E04).
      body.setLinvel({ x: this.input.move.x * 5, y: body.linvel().y, z: this.input.move.z * 5 }, true);
    }, SimPhase.intent);
    this.events.on('sim.tick', () => this.physics.update(), SimPhase.physics);
    this.events.on('sim.tick', () => {
      const p = this.physics.playerBody!.translation();
      Object.assign(this.entities.get(1)!.transform, p);
      this.spatial.set(1, p.x, p.z);
    }, SimPhase.cleanup);
    this.events.emit({ tick: 0, type: 'scenario.loaded', name, seed });
  }
  setInput(patch: Partial<InputFrame>): void {
    const next = { ...this.input, ...structuredClone(patch) };
    for (const vector of [next.move, next.aim]) if (!Number.isFinite(vector.x) || !Number.isFinite(vector.z)) throw new RangeError('Input vectors must be finite');
    this.input = next;
  }
  clearInput(): void { this.input = emptyInput(); }
  update(): void { if (this.scenario) this.events.emit({ type: 'sim.tick', tick: ++this.tick }); }
  getEntity(id: number): EntitySnapshot | null { return structuredClone(this.entities.get(id) ?? null); }
  query(filter: EntityFilter): EntitySnapshot[] {
    const nearby = filter.within ? new Set(this.spatial.query(filter.within)) : null;
    return structuredClone(this.entities.values().filter((e) => (!filter.kind || e.kind === filter.kind) && (!filter.archetype || e.archetype === filter.archetype) && (!nearby || nearby.has(e.id))));
  }
  getState(): GameStateSnapshot {
    return { tick: this.tick, seed: this.seed, scenario: this.scenario, player: this.getEntity(1), entities: this.query({}), mission: null, progression: null, rng: this.rng ? [this.rng.snapshot()] : [], perf: { entities: this.entities.size, bodies: this.physics.bodyCount, colliders: this.physics.colliderCount, listeners: this.events.listenerCount } };
  }
  reset(): void {
    this.physics.reset(); this.entities.reset(); this.spatial.reset(); this.events.reset();
    this.tick = 0; this.scenario = null; this.previousPlayer = null; this.rng = null; this.clearInput();
  }
  dispose(): void { this.reset(); }
}
