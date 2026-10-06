import type { Lifecycle } from './Lifecycle';

export const FIXED_DT = 1 / 60;

/** Fixed-step accumulator; render rate never changes the simulation delta. */
export class Clock implements Lifecycle {
  paused = false;
  timeScale = 1;
  private accumulator = 0;
  constructor(readonly maxCatchUp = 5) {}
  init(): void { this.reset(); }
  update(): void {}
  pause(): void { this.paused = true; this.accumulator = 0; }
  resume(): void { this.paused = false; }
  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0 || scale > 20) throw new RangeError('Time scale must be 0..20');
    this.timeScale = scale;
  }
  advance(realSeconds: number, step: () => void): number {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) throw new RangeError('Frame delta must be finite and nonnegative');
    if (this.paused) return 0;
    this.accumulator += realSeconds * this.timeScale;
    let count = 0;
    while (!this.paused && this.accumulator + 1e-10 >= FIXED_DT && count < this.maxCatchUp) {
      step(); this.accumulator = Math.max(0, this.accumulator - FIXED_DT); count++;
    }
    // Discard excess catch-up, keeping only the interpolation fraction.
    if (this.accumulator >= FIXED_DT) this.accumulator %= FIXED_DT;
    return count;
  }
  get alpha(): number { return this.accumulator / FIXED_DT; }
  reset(): void { this.accumulator = 0; this.timeScale = 1; this.paused = false; }
  dispose(): void { this.pause(); }
}
