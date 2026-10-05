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
  readonly nav: NavGrid;
  readonly rng: Rng;
  readonly active: EntitySnapshot[] = [];
  readonly pool: EntitySnapshot[] = [];
  readonly counters = { allocated: 0, reused: 0, released: 0 };
  readonly crowd: { transform: EntitySnapshot['transform']; radius: number }[] = [];
  private readonly neighbors: number[] = [];
  private readonly query = { x: 0, z: 0, r: 2 };
  private budget = 0;
  private readonly waypoint = { x: 0, z: 0 };
  constructor(readonly world: SimWorld, definition: ScenarioDefinition) {
    validateInfected(); this.rng = new Rng(world.seed, 'infected'); this.nav = new NavGrid(definition.ground, definition.walls ?? []);
    for (let i = 0; i < 350; i++) {
      const brain: InfectedState = { state: 'idle', speed: 0, until: 0, cooldown: 0, attackId: 0, special: '', hidden: false, deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: 0, packIndex: 0, birds: 0, birdPositions: new Array(60).fill(0), scatterUntil: 0, variant: '', path: [], pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: false };
      this.pool.push({ id: 0, kind: 'infected', archetype: '', faction: 'infected', health: { current: 0, max: 0 }, transform: { x: 0, y: 0.7, z: 0, yaw: 0 }, infected: brain, combat: { radius: 0.35, armor: 0, shield: false, staggerUntil: 0, attacking: false, damageMultiplier: 1, statuses: [] } }); this.counters.allocated++;
    }
    world.events.on('combat.attack', (event) => { if (event.type === 'combat.attack') this.noise(event.position, event.actionId.includes('pistol') || event.actionId.includes('shotgun') || event.actionId.includes('rifle') ? 25 : 6, event.actionId.includes('shotgun')); });
  }
  spawn(id: string, position: { x: number; z: number }, opts: InfectedSpawn = {}): number {
    const def = infectedDef(id);
    if (!Number.isFinite(position.x) || !Number.isFinite(position.z) || !this.nav.clear(position.x, position.z, def.radius)) throw new RangeError('Infected spawn inside collider or outside grid');
    const entity = this.pool.pop(); if (!entity) throw new Error('Infected pool exhausted');
    entity.archetype = id; entity.health.current = entity.health.max = def.hp;
    Object.assign(entity.transform, position); entity.transform.y = 0.7; entity.transform.yaw = opts.yaw ?? 0;
    Object.assign(entity.combat!, { radius: def.radius, armor: 0, shield: def.special === 'shield', staggerUntil: 0, attacking: false, damageMultiplier: 1 }); entity.combat!.statuses.length = 0;
    Object.assign(entity.infected!, { state: opts.state ?? 'idle', speed: def.speed, until: 0, cooldown: 0, attackId: 0, special: def.special, hidden: id === 'infected.cat', deadAt: -1, revived: false, reviveUsed: false, legLost: false, detached: false, pack: opts.pack ?? 0, packIndex: opts.packIndex ?? 0, birds: id === 'infected.crow' ? opts.birds ?? 20 : 0, scatterUntil: 0, variant: opts.variant ?? id, pathIndex: 0, goal: -1, dx: 0, dz: 0, grabHits: 0, grabUntil: 0, grabX: 0, grabZ: 0, perched: opts.perched ?? id === 'infected.cat' }); entity.infected!.path.length = 0;
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
      const b = e.infected!; if (e.health.current <= 0) { if (b.state !== 'dead') { b.state = 'dead'; b.deadAt = this.world.tick; } continue; }
      const dx = player.transform.x - e.transform.x, dz = player.transform.z - e.transform.z, distance = Math.hypot(dx, dz);
      if (b.state === 'idle' || b.state === 'wander') {
        if (distance <= 14 && (distance === 0 || (dx * Math.cos(e.transform.yaw) - dz * Math.sin(e.transform.yaw)) / distance >= Math.cos(55 * Math.PI / 180)) && this.world.combat!.query.visible(e.transform, player.transform)) this.alert(e);
        continue;
      }
      if (b.state === 'alerted') { if (this.world.tick >= b.until) b.state = 'chase'; else continue; }
      if (Status.stunned(e, this.world.tick)) { b.state = 'stagger'; continue; }
      if (b.state === 'stagger') b.state = 'chase';
      if (b.state === 'chase') {
        this.seek(e, player.transform); this.separate(e); this.world.spatial.set(e.id, e.transform.x, e.transform.z);
      }
    }
    // The player consumes borrowed transform references, never renderer state.
    for (const e of this.active) if (e.health.current > 0) this.crowd.push(this.obstacle(e));
    if (this.world.player) this.world.player.locomotion.crowd = this.crowd;
  }
  private readonly obstacles = new WeakMap<EntitySnapshot, { transform: EntitySnapshot['transform']; radius: number }>();
  private obstacle(e: EntitySnapshot) {
    let obstacle = this.obstacles.get(e); if (!obstacle) { obstacle = { transform: e.transform, radius: e.combat!.radius }; this.obstacles.set(e, obstacle); } return obstacle;
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
