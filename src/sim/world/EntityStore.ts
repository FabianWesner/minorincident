import type { EntitySnapshot } from './types';

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
  /** Authored lighting must not shift seeded actor IDs or their staggered AI ticks. */
  createAuxiliary(entity: Omit<EntitySnapshot, 'id'>): EntitySnapshot {
    const record = { ...entity, id: this.nextAuxiliaryId++ };
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
