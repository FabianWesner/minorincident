import type { PerspectiveCamera, Quaternion } from 'three/webgpu';
import { Rng } from '../../core/Rng';
import { l1Canon } from '../../levels/continuity';
import { SmokeColumn } from './labAccidentSmoke';

/** Seconds between puffs per emitter, and how long the column has already been standing when the level opens. */
const INTERVAL = .55, PREAGE = 9;
/**
 * Campaign continuity aftermath FX (src/levels/continuity.ts): the burned-out Medical Annex is still smouldering a few hours
 * after the L1 lab blast. A thin, paler column than the accident's (same opaque puff sprites, about 40 puffs at most),
 * already standing when L2 opens. Presentation only; the sim knows nothing about it.
 */
export class ContinuityFx {
  readonly column = new SmokeColumn(40, .34, 0, .55);
  private readonly rng: Rng;
  private time = 0;
  private next = 0;
  constructor(seed: number, private readonly facing: Quaternion, camera: PerspectiveCamera) {
    this.rng = new Rng(seed, 'continuity-smoke');
    this.column.name = 'continuity-smoke';
    this.column.camera = camera;
    // Pre-age the column so it is a landmark from the first frame (puffs born in the past rise and fade normally).
    this.time = -PREAGE; this.next = -PREAGE; this.emit();
    this.time = 0;
  }
  private emit(): void {
    for (; this.next <= this.time; this.next += INTERVAL)
      for (const v of l1Canon.annex.smoke) this.column.spawnPuff(this.next, this.rng, v.x, v.y, v.z);
  }
  advance(seconds: number): void {
    this.time += seconds; this.emit();
    this.column.advance(this.time, seconds, this.facing);
  }
  /** Re-face the puffs to the current camera without advancing time (paused/stepped frames, photo presets). */
  present(): void { this.column.advance(this.time, 0, this.facing); }
  get puffs(): number { return this.column.puffCount; }
  dispose(): void { this.column.dispose(); }
}
