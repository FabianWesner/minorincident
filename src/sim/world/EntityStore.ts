import type { EntitySnapshot } from './types';

/** A small component map with stable numeric IDs, reset per scenario. */
export class EntityStore {
  private readonly entities = new Map<number, EntitySnapshot>();
  private nextId = 1;
  create(entity: Omit<EntitySnapshot, 'id'>): EntitySnapshot {
    const record = { ...entity, id: this.nextId++ };
    this.entities.set(record.id, record); return record;
  }
  /** Checkpoint records keep numeric IDs stable for scripted actor references. */
  restore(records: EntitySnapshot[], player: EntitySnapshot): void {
    this.entities.clear(); this.nextId = 1;
    for (const entity of records) { this.entities.set(entity.id, entity.id === 1 ? player : entity); this.nextId = Math.max(this.nextId, entity.id + 1); }
  }
  get(id: number): EntitySnapshot | undefined { return this.entities.get(id); }
  values(): EntitySnapshot[] { return [...this.entities.values()].sort((a, b) => a.id - b.id); }
  iterate(): IterableIterator<EntitySnapshot> { return this.entities.values(); }
  get size(): number { return this.entities.size; }
  init(): void { this.reset(); }
  update(): void {}
  reset(): void { this.entities.clear(); this.nextId = 1; }
  dispose(): void { this.reset(); }
}
