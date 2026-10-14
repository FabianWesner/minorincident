import type { QualityTier } from '../../core/Quality';
import type { Aabb, Point } from '../../levels/districts/types';
import type { ScenarioDefinition } from '../../levels/loader';
import { NavGrid } from '../ai/NavGrid';
import { DistrictNavigation } from '../ai/DistrictNavigation';
import { selectTerrainChunks, type TerrainChunk } from './TerrainChunks';
import type { EntitySnapshot } from './types';
import type { SimWorld } from './SimWorld';

type Wall = NonNullable<ScenarioDefinition['walls']>[number];
interface SleepingEntity { tick: number; entity: EntitySnapshot; prop?: NonNullable<ReturnType<import('../interact/PropSystem').PropSystem['chunkState']>> }
export interface ChunkSnapshot { tick: number; tier: QualityTier; resident: string[]; inactive: [string, string][] }
interface OwnedCollider { aabb: Aabb; walkable: boolean; chunks: string[]; handle?: number }
/** Simulation ownership follows S3's selection, independently of asynchronous visual downloads.
 * Flat coarse ground stays in Physics, so visual delays/reversals never remove driveable support.
 * Collider handles and the bounded steering workspace are released as chunks leave residency;
 * inactive actors are JSON records, not pooled brains or live render/physics objects. */
export class ChunkResidency {
  private readonly loaded = new Set<string>();
  private readonly inactive = new Map<string, string>();
  private readonly cureChecked = new Map<string, string>();
  private readonly inactiveCounts = new Map<string, number>();
  private readonly waiting = new Set<string>();
  private readonly colliders: OwnedCollider[] = [];
  private readonly cells = new Map<string, TerrainChunk>();
  private readonly min: Point;
  private readonly lookup = new Map<string, TerrainChunk>();
  private signature = '';
  private activeBounds: { min: Point; max: Point; rectangular: boolean } | null = null;
  private tier: QualityTier = 'high';
  readonly walls: Wall[] = [];
  constructor(readonly world: SimWorld, readonly chunks: readonly TerrainChunk[], readonly size: number) {
    this.min = [Math.min(...chunks.map(c => c.origin[0])), Math.min(...chunks.map(c => c.origin[1]))];
    for (const c of chunks) { this.lookup.set(c.id, c); this.cells.set(this.cellKey(c.origin[0], c.origin[1]), c); }
    for (const d of world.districts!.districts) for (const c of [...d.decay.colliders, ...d.blockers.map(aabb => ({ aabb, walkable: false }))]) { const a = c.aabb; this.own({ ...a, min: [a.min[0] + d.origin[0], a.min[1], a.min[2] + d.origin[1]], max: [a.max[0] + d.origin[0], a.max[1], a.max[2] + d.origin[1]] }, c.walkable ?? false); }
    for (const a of world.districts!.boundaries) this.own(a);
  }
  private own(aabb: Aabb, walkable = false): void {
    const chunks = this.chunks.filter(c => aabb.min[0] <= c.max[0] && aabb.max[0] >= c.origin[0] && aabb.min[2] <= c.max[1] && aabb.max[2] >= c.origin[1]).map(c => c.id);
    this.colliders.push({ aabb, chunks, walkable });
  }
  private cellKey(x: number, z: number): string { return `${Math.floor((x - this.min[0]) / this.size)},${Math.floor((z - this.min[1]) / this.size)}`; }
  chunk(x: number, z: number): TerrainChunk | undefined { return this.cells.get(this.cellKey(x, z)); }
  resident(x: number, z: number): boolean {
    const b = this.activeBounds, worldBounds = this.world.districts!.nav;
    if (x < worldBounds.min[0] || x >= worldBounds.max[0] || z < worldBounds.min[1] || z >= worldBounds.max[1]) return false;
    if (!b || x < b.min[0] || x >= b.max[0] || z < b.min[1] || z >= b.max[1]) return false;
    if (b.rectangular) return true;
    const c = this.chunk(x, z); return !!c && this.loaded.has(c.id);
  }
  bounds(): ScenarioDefinition['ground'] {
    const cells = this.chunks.filter(c => this.loaded.has(c.id));
    const { min, max } = this.world.districts!.nav;
    const minX = Math.max(min[0], Math.min(...cells.map(c => c.origin[0]))), minZ = Math.max(min[1], Math.min(...cells.map(c => c.origin[1])));
    const maxX = Math.min(max[0], Math.max(...cells.map(c => c.max[0]))), maxZ = Math.min(max[1], Math.max(...cells.map(c => c.max[1])));
    return { width: maxX - minX, depth: maxZ - minZ, center: { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 } };
  }
  update(focus?: Point, velocity?: Point): void {
    const w = this.world, player = w.entities.get(1)!;
    const focusCar = w.vehicles?.active ?? (player.hidden ? w.vehicles?.autopilot.keys().next().value : undefined);
    const car = focusCar !== undefined && focusCar !== null ? w.vehicles?.cars.get(focusCar) : undefined;
    const position = car?.entity.transform ?? player.transform;
    const v = car?.physics.body.linvel();
    const selected = selectTerrainChunks(this.chunks, this.size, focus ?? [position.x, position.z], velocity ?? [v?.x ?? 0, v?.z ?? 0], this.tier);
    // Out-of-bounds story anchors cannot discard the final resident support set.
    if (!selected.length) return;
    const signature = selected.map(c => c.id).sort().join(',');
    if (signature !== this.signature) this.activate(selected);
    this.sleepOutside(); this.wakeInside();
  }
  private activate(selected: readonly TerrainChunk[]): void {
    this.loaded.clear(); for (const c of selected) this.loaded.add(c.id);
    this.signature = [...this.loaded].sort().join(',');
    const min: Point = [Math.min(...selected.map(c => c.origin[0])), Math.min(...selected.map(c => c.origin[1]))], max: Point = [Math.max(...selected.map(c => c.max[0])), Math.max(...selected.map(c => c.max[1]))];
    this.activeBounds = { min, max, rectangular: (max[0] - min[0]) * (max[1] - min[1]) / this.size ** 2 === selected.length };
    this.walls.length = 0;
    for (const c of this.colliders) {
      const live = c.chunks.some(id => this.loaded.has(id));
      if (live && c.handle === undefined) c.handle = this.world.physics.addStatic(c.aabb, [0, 0]);
      if (!live && c.handle !== undefined) { this.world.physics.removeBlocker(c.handle); delete c.handle; }
      if (live && !c.walkable && (c.aabb.navBlocker || c.aabb.min[1] < 1.8 && c.aabb.max[1] > .05)) {
        const a = c.aabb; this.walls.push({ x: (a.min[0] + a.max[0]) / 2, z: (a.min[2] + a.max[2]) / 2, y: (a.min[1] + a.max[1]) / 2, halfX: (a.max[0] - a.min[0]) / 2, halfZ: (a.max[2] - a.min[2]) / 2, halfY: (a.max[1] - a.min[1]) / 2, ...(a.navBlocker ? { navBlocker: true } : {}) });
      }
    }
    this.refreshNavigation();
  }
  private refreshNavigation(): void {
    const w = this.world, ai = w.infected;
    if (!ai) return;
    const ground = this.bounds();
    const mask = this.activeBounds?.rectangular ? null : (x: number, z: number) => this.resident(x, z);
    if (ai.nav.ground.width === ground.width && ai.nav.ground.depth === ground.depth && ai.nav.walls === this.walls) { ai.nav.mask = mask; ai.nav.recenter(ground.center!); }
    else ai.nav = new NavGrid(ground, this.walls, .5, ground.center, mask);
    for (const [id, wall] of w.props?.navWalls ?? []) if (this.resident(wall.x, wall.z)) ai.nav.setBlocker(id, wall, true);
    for (const wall of w.interactables?.walls ?? []) if (wall.entityId !== undefined && this.resident(wall.x, wall.z)) ai.nav.setBlocker(wall.entityId, wall, true);
    ai.navigation = new DistrictNavigation({ name: 'streamed', ground, player: w.entities.get(1)!.transform }, ai.nav);
    const cover = w.combat?.query.walls as Wall[] | undefined;
    if (cover) { cover.splice(0, cover.length, ...this.walls); w.combat!.query.invalidate(); }
    for (const e of w.entities.iterate()) { const brain = e.infected ?? e.civilian ?? e.escort ?? e.companion; if (brain) { brain.path.length = 0; brain.goal = -1; } }
    w.megaPursuit?.invalidateNavigation();
  }
  private managed(e: EntitySnapshot): boolean {
    return e.id !== 1 && !e.infected?.pursuit && !e.companion && e.attachedTo === undefined && !e.vehicle && !!(e.infected || e.corpse || e.pickup || e.civilian || e.escort || e.kind === 'physics-prop');
  }
  private sleepOutside(): void {
    const batches = new Map<string, SleepingEntity[]>();
    const ai = this.world.infected, excess = new Set<number>();
    if (ai && ai.director.count > ai.director.cap) {
      let count = ai.director.count; const player = this.world.entities.get(1)!.transform;
      const candidates = ai.active.filter(e => this.managed(e) && (e.health.current > 0 || ai.director.strict && e.infected!.recoverAt >= 0));
      candidates.sort((a, b) => Math.hypot(b.transform.x - player.x, b.transform.z - player.z) - Math.hypot(a.transform.x - player.x, a.transform.z - player.z) || b.id - a.id);
      for (const e of candidates) { if (count <= ai.director.cap) break; excess.add(e.id); count -= e.archetype === 'infected.crow' ? e.infected!.birds * .25 : 1; }
    }
    for (const e of this.world.entities.iterate()) if (this.managed(e) && (!this.resident(e.transform.x, e.transform.z) || excess.has(e.id))) {
      const c = this.chunk(e.transform.x, e.transform.z); if (!c) continue;
      let batch = batches.get(c.id);
      if (!batch) { batch = JSON.parse(this.inactive.get(c.id) ?? '[]') as SleepingEntity[]; batches.set(c.id, batch); }
      const entity = structuredClone(e);
      if (entity.infected) { entity.infected.path.length = 0; entity.infected.goal = -1; }
      const prop = e.kind === 'physics-prop' ? this.world.props?.chunkState(e.id) : undefined;
      batch.push({ tick: this.world.tick, entity, ...(prop ? { prop } : {}) });
      if (prop) this.world.props!.unloadChunk(e.id);
      if (e.infected && !e.corpse) this.world.infected?.release(e);
      this.world.entities.delete(e.id); this.world.spatial.delete(e.id);
    }
    for (const [id, batch] of batches) { this.inactive.set(id, JSON.stringify(batch)); this.inactiveCounts.set(id, batch.length); this.waiting.delete(id); }
  }
  private wakeInside(): void {
    const w = this.world, ai = w.infected;
    for (const id of this.loaded) {
      const saved = this.inactive.get(id); if (!saved || this.waiting.has(id) && ai && ai.director.count >= ai.director.cap) continue;
      const waiting: SleepingEntity[] = [];
      for (const record of JSON.parse(saved) as SleepingEntity[]) {
        const e = record.entity;
        const weight = e.archetype === 'infected.crow' ? (e.infected?.birds ?? 0) * .25 : 1;
        if (e.infected && !e.corpse && (!ai || ai.director.count + weight > ai.director.cap || !ai.pool.length)) { waiting.push(record); continue; }
        this.shiftTimers(e, w.tick - record.tick);
        w.entities.replace(e); w.spatial.set(e.id, e.transform.x, e.transform.z);
        if (record.prop) w.props!.loadChunk(e.id, record.prop);
        if (e.infected && !e.corpse) { ai!.pool.pop(); ai!.active.push(e); }
      }
      if (waiting.length) { this.inactive.set(id, JSON.stringify(waiting)); this.inactiveCounts.set(id, waiting.length); this.waiting.add(id); } else { this.inactive.delete(id); this.inactiveCounts.delete(id); this.waiting.delete(id); }
    }
  }
  private shiftTimers(e: EntitySnapshot, delta: number): void {
    const b = e.infected;
    if (b) {
      for (const key of ['until', 'cooldown', 'activeUntil', 'grabUntil', 'grabNextTick', 'scatterUntil'] as const) if (b[key]) b[key] += delta;
      if (b.recoverAt >= 0) { b.recoverAt += delta; b.deadAt += delta; }
      this.world.infected?.restoreSpecialTimers(b, delta);
    }
    const c = e.civilian;
    if (c) {
      c.entered += delta; for (const key of ['until', 'pauseUntil', 'knockedUntil', 'activityUntil', 'activityStarted'] as const) if (c[key]) c[key]! += delta;
      if (c.vehicleYield) c.vehicleYield.until += delta; if (c.lastTravelProgress !== undefined) c.lastTravelProgress += delta;
      if (c.survivor?.waitAt) c.survivor.waitAt += delta;
      if (c.l1) { c.l1.repickAt += delta; if (c.l1.noticed >= 0) c.l1.noticed += delta; if (c.l1.graceUntil) c.l1.graceUntil += delta; if (c.l1.progressAt !== undefined) c.l1.progressAt += delta; if (c.l1.doorAt !== undefined) c.l1.doorAt += delta; }
    }
    if (e.infectionRise) { e.infectionRise.started += delta; e.infectionRise.until += delta; }
    if (e.infection) { e.infection.startedTick += delta; e.infection.endsTick += delta; }
    if (e.escort) { e.escort.downedAt += delta; if (e.escort.attackAt) e.escort.attackAt += delta; if (e.escort.knockedUntil) e.escort.knockedUntil += delta; }
    if (e.combat?.reaction) { e.combat.reaction.started += delta; e.combat.reaction.until += delta; }
    if (e.combat) { if (e.combat.staggerUntil) e.combat.staggerUntil += delta; for (const status of e.combat.statuses) { status.expires += delta; status.nextDot += delta; } }
  }
  setQuality(tier: QualityTier): void { this.tier = tier; this.world.infected?.director.setTier(tier); this.update(); }
  /** Compact inactive records are counted only for authored spawn admission, never every AI tick. */
  *inactiveEntities(): IterableIterator<EntitySnapshot> {
    for (const json of this.inactive.values()) for (const record of JSON.parse(json) as SleepingEntity[]) yield record.entity;
  }
  /** Mutate compact sleeping snapshots without loading any region assets, physics or AI. */
  applyCure(affect: (entity: EntitySnapshot) => boolean, reached?: (chunk: TerrainChunk) => boolean): void {
    for (const [id, json] of this.inactive) {
      if (this.cureChecked.get(id) === json || reached && !reached(this.lookup.get(id)!)) continue;
      const records = JSON.parse(json) as SleepingEntity[];
      let changed = false;
      for (const record of records) if (affect(record.entity)) { record.tick = this.world.tick; changed = true; }
      const updated = changed ? JSON.stringify(records) : json;
      if (changed) { this.inactive.set(id, updated); this.waiting.delete(id); }
      if (!records.some(r => r.entity.infected && !r.entity.corpse && (r.entity.health.current > 0 || r.entity.infected.recoverAt >= 0))) this.cureChecked.set(id, updated);
    }
  }
  consumedPickups(): number[] {
    const consumed: number[] = [];
    for (const json of this.inactive.values()) for (const { entity: e } of JSON.parse(json) as SleepingEntity[]) if (e.pickup && 'kind' in e.pickup && e.pickup.collected && e.pickup.kind !== 'item' && e.pickup.kind !== 'throwable') consumed.push(e.id);
    return consumed;
  }
  /** Campaign save includes resident actors; checkpoints already capture them in EntityStore. */
  save() { return { state: this.snapshot(), entities: structuredClone(this.world.entities.values().filter(e => this.managed(e))), props: (this.world.props?.items ?? []).filter(p => { const e = this.world.entities.get(p.entityId); return !!e && this.managed(e); }).map(p => [p.entityId, this.world.props!.chunkState(p.entityId)!] as const) }; }
  load(saved: ReturnType<ChunkResidency['save']>): void {
    const w = this.world, ai = w.infected;
    this.tier = saved.state.tier; ai?.director.setTier(this.tier);
    for (const e of w.entities.values()) if (this.managed(e)) { if (e.infected && !e.corpse) ai?.release(e); if (e.kind === 'physics-prop') w.props?.unloadChunk(e.id); w.entities.delete(e.id); w.spatial.delete(e.id); }
    for (const e of structuredClone(saved.entities)) {
      this.shiftTimers(e, w.tick - saved.state.tick); w.entities.replace(e); w.spatial.set(e.id, e.transform.x, e.transform.z);
      if (e.infected && !e.corpse) { ai?.pool.pop(); ai?.active.push(e); }
    }
    for (const [id, prop] of saved.props ?? []) w.props?.loadChunk(id, prop);
    this.restore(saved.state);
  }
  snapshot(): ChunkSnapshot { return { tick: this.world.tick, tier: this.tier, resident: [...this.loaded].sort(), inactive: [...this.inactive] }; }
  restore(value: unknown): void {
    const saved = structuredClone(value) as ChunkSnapshot;
    for (const p of [...this.world.props?.items ?? []]) if (!this.world.entities.get(p.entityId)) this.world.props!.unloadChunk(p.entityId);
    const consumed = new Set(this.consumedPickups());
    this.inactive.clear(); this.cureChecked.clear(); this.inactiveCounts.clear(); this.waiting.clear();
    // Keep each record in its capture clock. Wake shifts once from that clock to the current tick;
    // pre-shifting on save reload can turn a future recovery into the -1/no-recovery sentinel range.
    for (const [id, json] of saved.inactive) {
      const records = JSON.parse(json) as SleepingEntity[];
      for (const r of records) if (consumed.has(r.entity.id) && r.entity.pickup && 'kind' in r.entity.pickup) r.entity.pickup.collected = true;
      this.inactive.set(id, JSON.stringify(records)); this.inactiveCounts.set(id, records.length);
      this.world.entities.reserveIds(records.map(r => r.entity.id));
    }
    if (saved.tier === this.tier) this.activate(saved.resident.map(id => this.lookup.get(id)!).filter(Boolean));
    else {
      // Graphics preferences are not rolled back by a checkpoint retry.
      const car = this.world.entities.values().find(e => e.vehicle?.driver === 1), p = car?.transform ?? this.world.entities.get(1)!.transform;
      const speed = car?.vehicle?.forwardSpeed ?? 0;
      this.activate(selectTerrainChunks(this.chunks, this.size, [p.x, p.z], [Math.cos(p.yaw) * speed, -Math.sin(p.yaw) * speed], this.tier));
    }
    this.sleepOutside(); this.wakeInside();
  }
  stats() { return { resident: this.loaded.size, queued: [...this.loaded].reduce((n, id) => n + (this.inactiveCounts.get(id) ?? 0), 0), unloaded: this.chunks.length - this.loaded.size, inactive: this.inactive.size, colliders: this.colliders.filter(c => c.handle !== undefined).length, navCells: this.world.infected?.nav.blocked.length ?? 0 }; }
  dispose(): void { for (const c of this.colliders) if (c.handle !== undefined) this.world.physics.removeBlocker(c.handle); this.loaded.clear(); this.inactive.clear(); this.cureChecked.clear(); this.inactiveCounts.clear(); this.waiting.clear(); }
}
