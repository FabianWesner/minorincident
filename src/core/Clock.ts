import type { Lifecycle } from './Lifecycle';

export const FIXED_DT = 1 / 60;
/** perf-w5d: simulation CPU one rendered frame may spend on catch-up ticks before the rest waits for the next frame. */
export const SIM_FRAME_BUDGET_MS = 25;
const wallMs = (): number => (globalThis as { performance?: { now(): number } }).performance?.now() ?? 0;

/**
 * Fixed-step accumulator; render rate never changes the simulation delta.
 * With a `budgetMs`, a frame stops stepping once the next tick (estimated from this frame's average tick) would exceed
 * the budget: the owed ticks stay in the accumulator (at most `maxCatchUp`) and run on the following frames, so one
 * expensive tick is not followed by a frame that pays for several catch-up ticks at once (a catch-up spiral). The ticks
 * themselves, their order and their inputs are unchanged; only how many run inside one rendered frame.
 * The budget never shortens a frame below half its own real duration (slow renderers keep pace) and applies only at
 * normal or slower time scales (test fast-forward keeps its full catch-up).
 */
export class Clock implements Lifecycle {
  paused = false;
  timeScale = 1;
  /** Ticks left owed by the last `advance` because of the budget (diagnostics). */
  deferred = 0;
  private accumulator = 0;
  constructor(readonly maxCatchUp = 5, readonly budgetMs = Infinity, private readonly now: () => number = wallMs) {}
  init(): void { this.reset(); }
  update(): void {}
  pause(): void { this.paused = true; this.accumulator = 0; this.deferred = 0; }
  resume(): void { this.paused = false; }
  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0 || scale > 20) throw new RangeError('Time scale must be 0..20');
    this.timeScale = scale;
  }
  advance(realSeconds: number, step: () => void): number {
    if (!Number.isFinite(realSeconds) || realSeconds < 0) throw new RangeError('Frame delta must be finite and nonnegative');
    if (this.paused) return 0;
    this.accumulator += realSeconds * this.timeScale;
    const budget = Number.isFinite(this.budgetMs) && this.timeScale <= 1 ? Math.max(this.budgetMs, realSeconds * 500) : Infinity;
    const start = budget < Infinity ? this.now() : 0;
    let count = 0, held = false;
    while (!this.paused && this.accumulator + 1e-10 >= FIXED_DT && count < this.maxCatchUp) {
      if (count > 0 && budget < Infinity) {
        const spent = this.now() - start;
        if (spent + spent / count > budget) { held = true; break; }
      }
      step(); this.accumulator = Math.max(0, this.accumulator - FIXED_DT); count++;
    }
    if (held) {
      // Owed ticks wait for the next frames; the backlog stays bounded by the catch-up cap.
      this.accumulator = Math.min(this.accumulator, this.maxCatchUp * FIXED_DT);
      this.deferred = Math.floor((this.accumulator + 1e-10) / FIXED_DT);
    } else {
      this.deferred = 0;
      // Discard excess catch-up, keeping only the interpolation fraction.
      if (this.accumulator >= FIXED_DT) this.accumulator %= FIXED_DT;
    }
    return count;
  }
  /** Interpolation fraction between the last two ticks (1 while ticks are owed). */
  get alpha(): number { return Math.min(1, this.accumulator / FIXED_DT); }
  reset(): void { this.accumulator = 0; this.deferred = 0; this.timeScale = 1; this.paused = false; }
  dispose(): void { this.pause(); }
}
