// Adapted from folio-2025 by Bruno Simon (MIT).

export interface EventRecord { tick: number; type: string }
export const SimPhase = { input: 0, intent: 1, ai: 2, physics: 3, combat: 4, missions: 5, cleanup: 6 } as const;

/** Ordered callback buckets, stable insertion order within each phase. */
export class EventBus<E extends EventRecord> {
  private readonly callbacks = new Map<string, Map<number, Set<(event: E) => void>>>();
  private readonly log: E[] = [];
  private next = 0;
  private length = 0;
  on(type: E['type'], callback: (event: E) => void, order = 1): () => void {
    let phases = this.callbacks.get(type);
    if (!phases) this.callbacks.set(type, phases = new Map());
    let bucket = phases.get(order);
    if (!bucket) phases.set(order, bucket = new Set());
    bucket.add(callback);
    return () => { bucket.delete(callback); if (!bucket.size) phases.delete(order); if (!phases.size) this.callbacks.delete(type); };
  }
  emit(event: E): void {
    this.log[this.next] = structuredClone(event);
    this.next = (this.next + 1) % 10000;
    this.length = Math.min(10000, this.length + 1);
    const phases = this.callbacks.get(event.type);
    if (phases) for (const order of [...phases.keys()].sort((a, b) => a - b)) {
      for (const callback of [...(phases.get(order) ?? [])]) callback(event);
    }
  }
  /** Returns events strictly after sinceTick; callers receive independent data. */
  events(sinceTick = -1): E[] {
    const output: E[] = [];
    for (let i = 0; i < this.length; i++) {
      const event = this.log[(this.next - this.length + i + 10000) % 10000];
      if (event.tick > sinceTick) output.push(structuredClone(event));
    }
    return output;
  }
  get listenerCount(): number {
    let count = 0;
    for (const phases of this.callbacks.values()) for (const bucket of phases.values()) count += bucket.size;
    return count;
  }
  reset(): void { this.callbacks.clear(); this.log.length = 0; this.next = 0; this.length = 0; }
  init(): void { this.reset(); }
  update(): void {}
  dispose(): void { this.reset(); }
}
