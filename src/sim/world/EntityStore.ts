import type { EntitySnapshot } from './types';
import { fnv1a } from '../../core/Rng';

/** Actor sequence epochs from the pre-namespace replay baseline. These preserve existing AI/RNG phases;
 * they are fixed per authored level/scene key and must not be recalculated when dressing changes. */
const actorSequenceEpochs: Readonly<Record<string, number>> = {
  L1: 78, L2: 102, L3: 21, L4: 24, L5: 16, L6: 13, L7: 18, L8: 352, L9: 665, L10: 97,
  'scene:seat-bench-l1-start': 3,
};

/** A small component map with stable numeric IDs, reset per scenario. */
export class EntityStore {
  private readonly entities = new Map<number, EntitySnapshot>();
  /** Membership changes invalidate lightweight actor query caches, including same-tick pool reuse. */
  revision = 0;
  private nextId = 1;
  private nextAuxiliaryId = 1_000_000_000;
  create(entity: Omit<EntitySnapshot, 'id'>): EntitySnapshot {
    const record = { ...entity, id: this.nextId++ };
    this.entities.set(record.id, record); this.revision++; return record;
  }
  /** Keep incoming campaign identities free before the new level allocates its cast. */
  reserveIds(ids: readonly number[]): void {
    for (const id of ids) {
      if (id >= 1_000_000_000) this.nextAuxiliaryId = Math.max(this.nextAuxiliaryId, id + 1);
      else this.nextId = Math.max(this.nextId, id + 1);
    }
  }
  /** Begin a stable level-keyed actor sequence, retaining the shipped gameplay baseline. */
  beginActorSequence(level: string): void { this.nextId += actorSequenceEpochs[level] ?? 0; }
  /** Authored lighting/props must not shift actor IDs. A placement key also survives insertion/reordering of other props. */
  createAuxiliary(entity: Omit<EntitySnapshot, 'id'>, key?: string): EntitySnapshot {
    const id = key === undefined ? this.nextAuxiliaryId++ : 1_100_000_000 + fnv1a(key) % 900_000_000;
    if (this.entities.has(id)) throw new Error(`Auxiliary entity ID collision: ${key ?? id}`);
    const record = { ...entity, id };
    this.entities.set(record.id, record); this.revision++; return record;
  }
  /** Adopt a prewarmed pooled record without creating a new entity object. */
  adopt(entity: EntitySnapshot): void { entity.id = this.nextId++; this.entities.set(entity.id, entity); this.revision++; }
  delete(id: number): void { if (this.entities.delete(id)) this.revision++; }
  replace(entity: EntitySnapshot): void {
    this.revision++;
    this.entities.set(entity.id, entity);
    if (entity.id >= 1_000_000_000) this.nextAuxiliaryId = Math.max(this.nextAuxiliaryId, entity.id + 1);
    else this.nextId = Math.max(this.nextId, entity.id + 1);
  }
  /** Checkpoint records keep numeric IDs stable for scripted actor references. */
  restore(records: EntitySnapshot[], player: EntitySnapshot): void {
    this.revision++;
    this.entities.clear(); this.nextId = 1; this.nextAuxiliaryId = 1_000_000_000;
    for (const entity of records) {
      this.entities.set(entity.id, entity.id === 1 ? player : entity);
      if (entity.id >= 1_000_000_000) this.nextAuxiliaryId = Math.max(this.nextAuxiliaryId, entity.id + 1);
      else this.nextId = Math.max(this.nextId, entity.id + 1);
    }
  }
  get(id: number): EntitySnapshot | undefined { return this.entities.get(id); }
  values(): EntitySnapshot[] { return [...this.entities.values()].sort((a, b) => a.id - b.id); }
  iterate(): IterableIterator<EntitySnapshot> { return this.entities.values(); }
  remove(id: number): void { this.delete(id); }
  get size(): number { return this.entities.size; }
  init(): void { this.reset(); }
  update(): void {}
  reset(): void { this.revision++; this.entities.clear(); this.nextId = 1; this.nextAuxiliaryId = 1_000_000_000; }
  dispose(): void { this.reset(); }
}
