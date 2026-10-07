import { moveAgent } from '../locomotion/AgentMotion';
import { infectedDef } from '../../data/infected';
import type { InfectedSystem, InfectedSpawn } from './InfectedSystem';
import type { EntitySnapshot } from '../world/types';
/** Conservative ground camera footprint, authored with the gameplay camera. Expanded 10% at query time. */
export interface CameraEnvelope { x: number; z: number; halfWidth: number; halfDepth: number; yaw: number }
interface Request { archetype: string; position: { x: number; z: number }; options: InfectedSpawn; turning?: boolean; migration?: { group: Migration; index: number } }
export interface Migration {
  points: readonly { x: number; z: number }[]; offsets: readonly { x: number; z: number }[]; samples: Float64Array; lengths: Float64Array;
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
  private cameraPosition: { x: number; y: number; z: number } | null = null;
  private hasFrustum = false;
  private readonly frustum = new Float64Array(16);
  constructor(readonly ai: InfectedSystem) {
    for (let i = 0; i < 16; i++) this.spawnPoints.push({ x: Math.cos(i * Math.PI / 8) * 52, z: Math.sin(i * Math.PI / 8) * 52 });
  }
  /** Defer future ambient spawns when quality lowers the living population cap. */
  setTier(tier: 'high' | 'low'): void {
    // Quality changes affect future spawns. Existing figures retain identity and
    // appearance; the new cap takes effect as the living population falls.
    this.tier = tier;
  }
  get cap(): number { return this.tier === 'low' ? Math.floor(this.levelCap / 2) : this.levelCap; }
  get count(): number {
    let count = 0; for (const e of this.ai.active) if (e.health.current > 0) count += e.archetype === 'infected.crow' ? e.infected!.birds * 0.25 : 1; return count;
  }
  /** Plain geometric camera-volume input. The sim never imports or reads a renderer/camera object. */
  setFrustum(matrix: readonly number[], position?: { x: number; y: number; z: number }): void {
    if (matrix.length !== 16 || !matrix.every(Number.isFinite)) throw new RangeError('Invalid spawn frustum');
    this.cameraPosition = position ? { ...position } : null;
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
  /** Test the whole human silhouette against the expanded viewport. */
  offscreen(position: { x: number; z: number }): boolean {
    return [-.5, .5].every(dx => [-.5, .5].every(dz => [.1, 1.9].every(y => !this.visible({ x: position.x + dx, z: position.z + dz, y }))));
  }
  /** A solid building must hide the entire rising silhouette, not just its feet. */
  occluded(position: { x: number; z: number }): boolean {
    const origin = this.cameraPosition;
    if (!origin) return false;
    return [-.5, .5].every(dx => [-.5, .5].every(dz => [.1, 1.9].every(y => (this.ai.world.combat?.definition.walls ?? []).some(wall => {
      if (wall.halfY * 2 < 2.2) return false;
      let near = 0, far = 1;
      for (const [axis, half] of [['x', wall.halfX], ['y', wall.halfY], ['z', wall.halfZ]] as const) {
        const end = axis === 'y' ? y : position[axis] + (axis === 'x' ? dx : dz), delta = end - origin[axis];
        if (Math.abs(delta) < 1e-8) { if (origin[axis] < wall[axis] - half || origin[axis] > wall[axis] + half) return false; }
        else { const a = (wall[axis] - half - origin[axis]) / delta, b = (wall[axis] + half - origin[axis]) / delta; near = Math.max(near, Math.min(a,b)); far = Math.min(far, Math.max(a,b)); }
      }
      return near < far && far > 0 && near < .98;
    }))));
  }
  safe(id: string, position: { x: number; z: number }, perched?: boolean): boolean {
    const target = this.ai.perchFor(id, position, perched) ?? position;
    const player = this.ai.world.entities.get(1)!;
    return Math.hypot(target.x - player.transform.x, target.z - player.transform.z) >= 18 && this.offscreen(target) && this.ai.nav.clear(target.x, target.z, infectedDef(id).radius);
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
    // Hexagonal lanes fit the stream without overlapping spawn circles. The old
    // compressed spiral needed continuous hard pushes, defeating bounded motion.
    const lanes: { x: number; z: number }[] = [], extent = Math.ceil(Math.sqrt(count));
    for (let z = -extent; z <= extent; z++) for (let x = -extent; x <= extent; x++) lanes.push({ x: .716 * (x + z / 2), z: .716 * z * Math.sqrt(3) / 2 });
    lanes.sort((a, b) => a.x * a.x + a.z * a.z - b.x * b.x - b.z * b.z || a.x - b.x || a.z - b.z);
    const offsets = lanes.slice(0, count);
    const migration: Migration = { offsets, requested: count, points, samples, lengths, length: lengths[256], speed, expectedSeconds: lengths[256] / speed, started: -1, arrived: 0, members: [] };
    // A stream uses several lanes, avoiding a single coincident spawn while preserving one spline.
    for (let i = 0; i < count; i++) {
      this.target.x = points[0].x + offsets[i].x; this.target.z = points[0].z + offsets[i].z;
      if (!this.safe('infected.runner', this.target)) throw new Error('Migration stream begins in an unsafe cell');
      this.request('infected.runner', this.target, { state: 'migration' }); this.queue[this.queue.length - 1].migration = { group: migration, index: i };
    }
    this.migrations.push(migration); this.update(); return migration;
  }
  private advanceMigration(e: EntitySnapshot): void {
    const record = this.migrationByEntity.get(e.id); if (!record) return;
    const { migration: m, index } = record, elapsed = (this.ai.world.tick - record.started) / 60;
    // The target describes the start of this integration step; feed-forward
    // advances it by one tick without permanently leading the authored spline.
    const distance = Math.max(0, elapsed - 1 / 60) * m.speed;
    let segment = 1; while (segment < 256 && m.lengths[segment] < distance) segment++;
    const t = Math.min(1, (distance - m.lengths[segment - 1]) / Math.max(0.0001, m.lengths[segment] - m.lengths[segment - 1]));
    const angle = index * 2.399963, offset = m.offsets[index];
    this.target.x = m.samples[segment * 2 - 2] * (1 - t) + m.samples[segment * 2] * t + offset.x;
    this.target.z = m.samples[segment * 2 - 1] * (1 - t) + m.samples[segment * 2 + 1] * t + offset.z;
    const dx = this.target.x - e.transform.x, dz = this.target.z - e.transform.z;
    // Predict the tangent over the response's ~1/3-second lag so a bend
    // does not drag the whole formation outside its authored arrival envelope.
    let tangent = segment; while (tangent < 256 && m.lengths[tangent] < distance + m.speed / 3) tangent++;
    const tx = m.samples[tangent * 2] - m.samples[tangent * 2 - 2], tz = m.samples[tangent * 2 + 1] - m.samples[tangent * 2 - 1];
    const length = Math.hypot(tx, tz) || 1, feedforward = distance < m.length ? m.speed : 0;
    // Follow the moving spline target without a permanent acceleration lag.
    const vx = tx / length * feedforward + dx * 3, vz = tz / length * feedforward + dz * 3;
    const scale = Math.min(1, m.speed * 1.5 / (Math.hypot(vx, vz) || 1));
    moveAgent(e, vx * scale, vz * scale, this.ai.nav, this.ai.world.tick); this.ai.world.spatial.set(e.id, e.transform.x, e.transform.z);
    if (elapsed >= m.expectedSeconds) { e.infected!.state = 'wander'; e.infected!.until = this.ai.world.tick + 600; e.infected!.dx = Math.cos(angle); e.infected!.dz = Math.sin(angle); m.arrived++; this.migrationByEntity.delete(e.id); }
  }
}
