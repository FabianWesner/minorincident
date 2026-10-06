// Adapted from folio-2025 Quality.js by Bruno Simon (MIT): mobile heuristic and change events.
export type QualityTier = 'high' | 'low';
export type QualitySetting = QualityTier | 'auto';
export const qualityBudgets = {
  high: { frameMs: 16.7, infected: 200, drawCalls: 600, triangles: 1_500_000, simMs: 4, heapMB: 400, pixelRatio: 2, shadowSize: 2048, bloomMips: 5, cullDistance: 60 },
  low: { frameMs: 1000 / 30, infected: 100, drawCalls: 300, triangles: 500_000, simMs: 6, heapMB: 250, pixelRatio: 1.5, shadowSize: 1024, bloomMips: 2, cullDistance: 45 },
} as const;
export interface QualityDevice { userAgent: string; touchPoints: number; coarsePointer: boolean; memoryGB?: number }
/** Port of Bruno's mobile heuristic, including touch-only tablets and small-memory devices. */
export function startingTier(device: QualityDevice): QualityTier {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(device.userAgent) || (device.touchPoints > 0 && device.coarsePointer) || (device.memoryGB !== undefined && device.memoryGB <= 4) ? 'low' : 'high';
}
/** Two-tier policy. A one-second p90 window must remain over budget for five seconds.
 * Sampling uses fixed buffers; only window boundaries sort. Auto never upgrades until a level starts.
 * The caller excludes loading/background/paused frames and supplies cinematic state. */
export class Quality {
  setting: QualitySetting;
  tier: QualityTier;
  p90Ms = 0;
  private elapsed = 0;
  private slowSeconds = 0;
  private count = 0;
  private readonly samples = new Float32Array(240);
  private readonly sorted = new Float32Array(240);
  private readonly listeners = new Set<(tier: QualityTier) => void>();
  constructor(setting: QualitySetting, private readonly device: QualityDevice) {
    this.setting = setting; this.tier = setting === 'auto' ? startingTier(device) : setting;
  }
  onChange(listener: (tier: QualityTier) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  set(setting: QualitySetting): void {
    if (!['high', 'low', 'auto'].includes(setting)) throw new RangeError('Invalid quality setting');
    this.setting = setting; this.startLevel();
  }
  startLevel(): void { this.resetSamples(); this.change(this.setting === 'auto' ? startingTier(this.device) : this.setting); }
  private change(tier: QualityTier): void {
    if (tier === this.tier) return;
    this.tier = tier; for (const listener of this.listeners) listener(tier);
  }
  private resetSamples(): void { this.elapsed = this.slowSeconds = this.count = this.p90Ms = 0; }
  observe(frameMs: number, seconds: number, cinematic = false): void {
    if (!Number.isFinite(frameMs) || frameMs <= 0 || !Number.isFinite(seconds) || seconds <= 0) return;
    this.samples[this.count++ % this.samples.length] = frameMs;
    this.elapsed += seconds;
    if (this.elapsed < 1) return;
    const count = Math.min(this.count, this.samples.length);
    this.sorted.set(this.samples.subarray(0, count));
    const window = this.sorted.subarray(0, count); window.sort();
    this.p90Ms = window[Math.ceil(count * .9) - 1];
    this.slowSeconds = this.setting === 'auto' && this.tier === 'high' && this.p90Ms > qualityBudgets.high.frameMs ? this.slowSeconds + this.elapsed : 0;
    this.elapsed = this.count = 0;
    if (this.setting === 'auto' && this.tier === 'high' && this.slowSeconds >= 5 && !cinematic) this.change('low');
  }
  snapshot() { return { setting: this.setting, tier: this.tier, p90Ms: this.p90Ms, slowSeconds: this.slowSeconds, budgets: qualityBudgets[this.tier] }; }
  dispose(): void { this.listeners.clear(); }
}
