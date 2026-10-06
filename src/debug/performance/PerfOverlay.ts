// Monitoring.js pattern adapted from Bruno Simon (MIT); no additional monitoring dependency.
import type { Game } from '../../Game';
/** Query-gated, throttled overlay. Counters share the test API's real renderer source. */
export class PerfOverlay {
  private readonly element = document.createElement('output');
  private elapsed = 0;
  constructor(private readonly game: Game) {
    this.element.dataset.perfOverlay = '';
    this.element.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));z-index:20;white-space:pre;background:#101826dd;color:#fff;padding:8px;font:12px monospace;pointer-events:none';
    document.body.append(this.element);
  }
  update(seconds: number): void {
    this.elapsed += seconds; if (this.elapsed < .25) return; this.elapsed = 0;
    const p = this.game.perf();
    this.element.textContent = `${p.quality.tier} (${p.quality.setting}) / ${p.backend}\n${p.fps.toFixed(0)} fps · ${p.frameMs.toFixed(1)} ms · p90 ${p.quality.p90Ms.toFixed(1)} ms\nsim ${p.simMs.toFixed(2)} ms · ${p.drawCalls} draws · ${p.triangles.toLocaleString()} tris\n${p.geometries} geometries · ${p.textures} textures · ${p.entities} entities`;
  }
  dispose(): void { this.element.remove(); }
}
