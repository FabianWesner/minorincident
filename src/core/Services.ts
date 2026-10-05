// Adapted from folio-2025 by Bruno Simon (MIT).
import type { Lifecycle } from './Lifecycle';

/** Staged boot and reverse-order teardown, adapted from Bruno's Game.js. */
export class Services implements Lifecycle {
  private readonly items: Lifecycle[] = [];
  add<T extends Lifecycle>(service: T): T { this.items.push(service); return service; }
  async init(): Promise<void> { for (const service of this.items) await service.init(); }
  update(): void { for (const service of this.items) service.update(); }
  reset(): void { for (const service of [...this.items].reverse()) service.reset(); }
  dispose(): void { for (const service of [...this.items].reverse()) service.dispose(); this.items.length = 0; }
}
