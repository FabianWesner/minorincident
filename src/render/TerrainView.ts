import { Group, Mesh, Object3D } from 'three/webgpu';
import type { DistrictAssets } from '../assets/DistrictAssets';
import type { Point } from '../levels/districts/types';
import type { QualityTier } from '../core/Quality';
import { selectTerrainChunks, terrainChunkBudgets, terrainPrefetchSeconds, type TerrainChunk } from '../sim/world/TerrainChunks';
import { InstancedGroup } from './InstancedGroup';
import { GroundField } from './GroundField';

interface Resident { batch: InstancedGroup; ground: GroundField; release: () => void; chunk: TerrainChunk }
/** Visual ownership only. Delayed downloads never change simulation support or input.
 * Coarse terrain stays in DistrictView; cell buffers and height samples unload together. */
export class TerrainView extends Group {
  private readonly resident = new Map<string, Resident>();
  private readonly pending = new Map<string, Promise<void>>();
  private desired = new Map<string, TerrainChunk>();
  private focus?: Point;
  private velocity: Point = [0, 0];
  private disposed = false;
  private unloaded = 0;
  private failure: unknown;
  warm: ((batch: InstancedGroup) => Promise<void>) | null = null;
  swap: (() => Promise<void>) | null = null;
  constructor(private readonly chunks: readonly TerrainChunk[], private readonly size: number, private readonly url: (id: string) => string, private readonly registry: Pick<DistrictAssets, 'leaseGlb'>, private tier: QualityTier) { super(); }
  update(focus: Point, velocity: Point = [0, 0]): void {
    if (this.disposed) return;
    this.focus = focus; this.velocity = velocity;
    this.desired = new Map(selectTerrainChunks(this.chunks, this.size, focus, velocity, this.tier).map(c => [c.id, c]));
    for (const [id, cell] of this.resident) if (!this.desired.has(id)) {
      cell.batch.removeFromParent(); cell.batch.dispose(); cell.release(); this.resident.delete(id); this.unloaded++;
    }
    this.pump();
  }
  setQuality(tier: QualityTier): void {
    this.tier = tier;
    if (this.focus) this.update(this.focus, this.velocity);
  }
  private pump(): void {
    if (this.disposed || this.failure) return;
    // A stale request still owns its reserved slot until its arrays are released.
    // This bounds outstanding allocations too, during a teleport or quality drop.
    for (const [id, chunk] of this.desired) {
      if (this.pending.size >= 2 || this.resident.size + this.pending.size >= terrainChunkBudgets[this.tier]) break;
      if (this.resident.has(id) || this.pending.has(id)) continue;
      const work = this.load(chunk).catch(error => { this.failure = error; }).finally(() => { this.pending.delete(id); this.pump(); });
      this.pending.set(id, work);
    }
  }
  private async load(chunk: TerrainChunk): Promise<void> {
    const lease = this.registry.leaseGlb(this.url(chunk.id));
    let batch: InstancedGroup | undefined;
    try {
      const source = await lease.ready;
      if (this.disposed || !this.desired.has(chunk.id)) return;
      const ref = new Object3D(); ref.position.set(chunk.origin[0], 0, chunk.origin[1]);
      batch = new InstancedGroup(source, [ref]); batch.name = `terrain:${chunk.id}`;
      batch.traverse(node => { if (node instanceof Mesh) node.castShadow = false; });
      if (this.warm) await this.warm(batch);
      if (this.swap) await this.swap();
      if (this.disposed || !this.desired.has(chunk.id) || this.resident.size >= terrainChunkBudgets[this.tier]) return;
      this.add(batch); batch.freezeWorld();
      // GroundField reads ordinary prototype meshes, using the same cell transform.
      const groundRoot = source.clone(true); groundRoot.position.copy(ref.position); groundRoot.updateMatrixWorld(true);
      const ground = new GroundField(); groundRoot.traverse(node => { if (node instanceof Mesh) ground.add(node); });
      this.resident.set(chunk.id, { batch, ground, release: lease.release, chunk }); batch = undefined;
    } finally {
      batch?.removeFromParent();
      batch?.dispose();
      if (!this.resident.has(chunk.id)) lease.release();
    }
  }
  height(x: number, z: number): number | null {
    for (const cell of this.resident.values()) {
      // NPC feet, tyres and effects ask many times per frame. Reject unrelated
      // cells before the height-field lookup; keep the authored 1 mm seam apron.
      const { origin, max } = cell.chunk;
      if (x < origin[0] - .01 || x > max[0] + .01 || z < origin[1] - .01 || z > max[1] + .01) continue;
      const h = cell.ground.height(x, z); if (h !== null) return h;
    }
    return null;
  }
  snapshot() {
    return { resident: this.resident.size, queued: [...this.desired.keys()].filter(id => !this.resident.has(id)).length, loading: this.pending.size, unloaded: this.unloaded,
      limit: terrainChunkBudgets[this.tier], prefetchSeconds: terrainPrefetchSeconds,
      chunks: [...this.resident.keys()], origins: [...this.desired.values()].map(c => ({ id: c.id, origin: [...c.origin] as Point })) };
  }
  async ready(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending.values());
    if (this.failure) throw this.failure;
  }
  dispose(): void {
    this.disposed = true; this.desired.clear();
    for (const cell of this.resident.values()) { cell.batch.dispose(); cell.release(); }
    this.resident.clear(); this.clear();
  }
}
