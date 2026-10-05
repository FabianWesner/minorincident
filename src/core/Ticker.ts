// Adapted from folio-2025 by Bruno Simon (MIT).
import { EventBus } from './EventBus';
import type { Lifecycle } from './Lifecycle';

type FrameEvent = { tick: number; type: 'frame'; seconds: number };
/** Browser-only frame source. Simulation receives elapsed seconds, never RAF IDs. */
export class Ticker implements Lifecycle {
  readonly events = new EventBus<FrameEvent>();
  private handle: number | null = null;
  private previous: number | null = null;
  private frames = 0;
  init(): void { this.handle = requestAnimationFrame(this.frame); }
  private readonly frame = (now: number): void => {
    const seconds = this.previous === null ? 0 : Math.max(0, (now - this.previous) / 1000);
    this.previous = now;
    this.events.emit({ type: 'frame', tick: ++this.frames, seconds });
    this.handle = requestAnimationFrame(this.frame);
  };
  update(): void {}
  reset(): void { this.previous = null; }
  dispose(): void { if (this.handle !== null) cancelAnimationFrame(this.handle); this.handle = null; this.events.dispose(); }
}
