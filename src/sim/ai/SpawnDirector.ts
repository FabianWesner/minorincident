import { infectedDef } from '../../data/infected';
import type { InfectedSystem, InfectedSpawn } from './InfectedSystem';
import type { EntitySnapshot } from '../world/types';
/** Conservative ground camera footprint, authored with the gameplay camera. Expanded 10% at query time. */
export interface CameraEnvelope { x: number; z: number; halfWidth: number; halfDepth: number; yaw: number }
interface Request { archetype: string; position: { x: number; z: number }; options: InfectedSpawn; turning?: boolean; migration?: { group: Migration; index: number } }
export interface Migration {
  points: readonly { x: number; z: number }[]; samples: Float64Array; lengths: Float64Array;
  requested: number; length: number; speed: number; expectedSeconds: number; started: number; arrived: number; members: number[];
}
/** Level-owned director: caps use weighted living entities; scripted requests remain queued until safe. */
export class SpawnDirector {
  tier: 'high' | 'low' = 'high';
  levelCap = 200;
  readonly queue: Request[] = [];
  readonly spawnPoints: { x: number; z: number }[] = [];
  readonly camera: CameraEnvelope = { x: 0, z: 0, halfWidth: 32, halfDepth: 32, yaw: 0 };
  readonly migrations: Migration[] = [];
  private readonly migrationByEntity = new Map<number, { migration: Migration; index: number; started: number }>();
  private readonly target = { x: 0, z: 0 };
  ambientTarget = 0;
  private point = 0;
  private hasFrustum = false;
  private readonly frustum = new Float64Array(16);
  constructor(readonly ai: InfectedSystem) {
    for (let i = 0; i < 16; i++) this.spawnPoints.push({ x: Math.cos(i * Math.PI / 8) * 52, z: Math.sin(i * Math.PI / 8) * 52 });
  }
  /** E18 transition: keep mission actors and the nearest threats; defer excess ambient spawns.
   * Population reduction is a despawn, never a kill or objective completion. */
  setTier(tier: 'high' | 'low'): void {
    this.tier = tier; if (this.count <= this.cap) return;
    const player = this.ai.world.entities.get(1)!.transform;
    const actors = new Set(Object.values(this.ai.world.missions?.state.actors ?? {}));
    const excess = this.ai.active.filter(e => e.health.current > 0 && !actors.has(e.id));
    excess.sort((a, b) => Math.hypot(b.transform.x - player.x, b.transform.z - player.z) - Math.hypot(a.transform.x - player.x, a.transform.z - player.z));
    for (const entity of excess) {
      if (this.count <= this.cap) break;
      this.request(entity.archetype, entity.transform, { state: 'chase', variant: entity.infected!.variant, birds: entity.infected!.birds || undefined });
      this.ai.release(entity);
    }
  }
  get cap(): number { return this.tier === 'low' ? Math.floor(this.levelCap / 2) : this.levelCap; }
  get count(): number {
    let count = 0; for (const e of this.ai.active) if (e.health.current > 0) count += e.archetype === 'infected.crow' ? e.infected!.birds * 0.25 : 1; return count;
  }
  /** Plain geometric camera-volume input. The sim never imports or reads a renderer/camera object. */
  setFrustum(matrix: readonly number[]): void {
    if (matrix.length !== 16 || !matrix.every(Number.isFinite)) throw new RangeError('Invalid spawn frustum');
    this.frustum.set(matrix); this.hasFrustum = true;
  }
  visible(position: { x: number; z: number; y?: number }): boolean {
    if (this.hasFrustum) {
      const m = this.frustum, x = position.x, y = position.y ?? 0.7, z = position.z;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cz = m[2] * x + m[6] * y + m[10] * z + m[14], w = m[3] * x + m[7] * y + m[11] * z + m[15];
      return w > 0 && Math.abs(cx) <= w * 1.1 && Math.abs(cy) <= w * 1.1 && Math.abs(cz) <= w;
    }
    const c = this.camera, dx = position.x - c.x, dz = position.z - c.z;
    return Math.abs(dx * Math.cos(c.yaw) + dz * Math.sin(c.yaw)) <= c.halfWidth * 1.1 && Math.abs(-dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw)) <= c.halfDepth * 1.1;
  }
  safe(id: string, position: { x: number; z: number }, perched?: boolean): boolean {
    const target = this.ai.perchFor(id, position, perched) ?? position;
    const player = this.ai.world.entities.get(1)!;
    return Math.hypot(target.x - player.transform.x, target.z - player.transform.z) >= 18 && !this.visible(target) && this.ai.nav.clear(target.x, target.z, infectedDef(id).radius);
  }
  request(archetype: string, position: { x: number; z: number }, options: InfectedSpawn = {}): void {
    infectedDef(archetype); if (!Number.isFinite(position.x) || !Number.isFinite(position.z)) throw new RangeError('Spawn position must be finite');
    this.queue.push({ archetype, position: { ...position }, options: { ...options } });
  }
  /** E08 turning is an on-screen transformation, rather than an off-screen population spawn. */
  requestTurn(archetype: string, position: { x: number; z: number }, variant: string): void {
    this.request(archetype, position, { variant, state: 'chase' }); this.queue[this.queue.length - 1].turning = true;
  }
  wave(archetype: string, count: number): void {
    if (!Number.isInteger(count) || count < 0) throw new RangeError('Invalid wave size');
    for (let i = 0; i < count; i++) this.request(archetype, this.spawnPoints[this.point++ % this.spawnPoints.length], { state: 'chase' });
  }
  update(): void {
    const player = this.ai.world.entities.get(1)!;
    this.camera.x = player.transform.x; this.camera.z = player.transform.z;
    if (this.ambientTarget > this.count + this.queue.length && this.ai.world.tick % 60 === 0) this.wave('infected.runner', 1);
    let count = this.count;
    for (let i = 0; i < this.queue.length;) {
      const request = this.queue[i], weight = request.archetype === 'infected.crow' ? (request.options.birds ?? 20) * 0.25 : 1;
      if (count + weight > this.cap || !(request.turning ? this.ai.nav.clear(request.position.x, request.position.z, infectedDef(request.archetype).radius) : this.safe(request.archetype, request.position, request.options.perched)) || !this.ai.pool.length) { i++; continue; }
      const id = this.ai.spawn(request.archetype, request.position, request.options);
      if (request.migration) {
        const group = request.migration.group; if (!group.members.length) group.started = this.ai.world.tick;
        group.members.push(id); this.migrationByEntity.set(id, { migration: group, index: request.migration.index, started: this.ai.world.tick });
      }
      count += weight; this.queue.splice(i, 1);
    }
    for (const e of this.ai.active) if (e.infected!.state === 'migration') this.advanceMigration(e);
  }
  /** Catmull-Rom spline sampled once into an arc-length table, then traversed at constant speed. */
  migration(points: readonly { x: number; z: number }[], count = 150, speed = 4.2): Migration {
    if (points.length < 2 || !points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)) || !Number.isInteger(count) || count <= 0 || speed <= 0 || !Number.isFinite(speed)) throw new RangeError('Invalid migration');
    if (!this.safe('infected.runner', points[0])) throw new Error('Migration must begin at a safe spawn point');
    const samples = new Float64Array(514), lengths = new Float64Array(257);
    for (let i = 0; i <= 256; i++) {
      const t = i / 256 * (points.length - 1), segment = Math.min(points.length - 2, Math.floor(t)), u = t - segment;
      const p0 = points[Math.max(0, segment - 1)], p1 = points[segment], p2 = points[segment + 1], p3 = points[Math.min(points.length - 1, segment + 2)];
      for (const [axis, offset] of [['x', 0], ['z', 1]] as const) samples[i * 2 + offset] = 0.5 * (2 * p1[axis] + (-p0[axis] + p2[axis]) * u + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * u * u + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * u * u * u);
      if (i) lengths[i] = lengths[i - 1] + Math.hypot(samples[i * 2] - samples[i * 2 - 2], samples[i * 2 + 1] - samples[i * 2 - 1]);
    }
    const migration: Migration = { requested: count, points, samples, lengths, length: lengths[256], speed, expectedSeconds: lengths[256] / speed, started: -1, arrived: 0, members: [] };
    // A stream uses several lanes, avoiding a single coincident spawn while preserving one spline.
    for (let i = 0; i < count; i++) {
      const angle = i * 2.399963, radius = Math.sqrt(i) * 0.32;
      this.target.x = points[0].x + Math.cos(angle) * radius; this.target.z = points[0].z + Math.sin(angle) * radius;
      if (!this.safe('infected.runner', this.target)) throw new Error('Migration stream begins in an unsafe cell');
      this.request('infected.runner', this.target, { state: 'migration' }); this.queue[this.queue.length - 1].migration = { group: migration, index: i };
    }
    this.migrations.push(migration); this.update(); return migration;
  }
  private advanceMigration(e: EntitySnapshot): void {
    const record = this.migrationByEntity.get(e.id); if (!record) return;
    const { migration: m, index } = record, distance = (this.ai.world.tick - record.started) / 60 * m.speed;
    let segment = 1; while (segment < 256 && m.lengths[segment] < distance) segment++;
    const t = Math.min(1, (distance - m.lengths[segment - 1]) / Math.max(0.0001, m.lengths[segment] - m.lengths[segment - 1]));
    const angle = index * 2.399963, fan = Math.sqrt(index) * 0.32;
    this.target.x = m.samples[segment * 2 - 2] * (1 - t) + m.samples[segment * 2] * t + Math.cos(angle) * fan;
    this.target.z = m.samples[segment * 2 - 1] * (1 - t) + m.samples[segment * 2 + 1] * t + Math.sin(angle) * fan;
    this.ai.nav.move(e.transform, this.target.x - e.transform.x, this.target.z - e.transform.z, e.combat!.radius); this.ai.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (distance >= m.length) { e.infected!.state = 'wander'; e.infected!.until = this.ai.world.tick + 600; e.infected!.dx = Math.cos(angle); e.infected!.dz = Math.sin(angle); m.arrived++; this.migrationByEntity.delete(e.id); }
  }
}
