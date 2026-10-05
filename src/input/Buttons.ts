// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: Inputs/Inputs.js, commit 41046b5.
import type { Button } from './InputFrame';

/** Latches event transitions until the next tick, including a click between ticks. */
export class Buttons {
  private readonly sources = new Set<string>();
  private down = false;
  private up = false;
  private readonly frame: Button = { down: false, held: false, up: false };
  set(source: string, held: boolean): void {
    const wasHeld = this.sources.size > 0;
    if (held) this.sources.add(source); else this.sources.delete(source);
    if (!wasHeld && this.sources.size) this.down = true;
    if (wasHeld && !this.sources.size) this.up = true;
  }
  pulse(): void { this.down = true; this.up = true; }
  release(): void { if (this.sources.size) this.up = true; this.sources.clear(); this.down = false; }
  reset(): void { this.sources.clear(); this.down = false; this.up = false; Object.assign(this.frame, { down: false, held: false, up: false }); }
  /** Reused object, valid until the next sample; consumers copy only when recording. */
  sample(): Button {
    this.frame.down = this.down; this.frame.held = this.sources.size > 0; this.frame.up = this.up;
    this.down = false; this.up = false; return this.frame;
  }
}
