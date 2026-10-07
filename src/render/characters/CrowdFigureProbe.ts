import { Matrix4, Vector3 } from 'three';
import type { CrowdPosePalette } from './CrowdPosePalette';

/** Draw-submission and ankle probes, read only by the query-gated test API. */
export class CrowdFigureProbe {
  private readonly enabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');
  readonly figures: { id: number; instanceKey?: string; clip: string; phase: number; drawn: boolean; feet: number[][] }[] = [];
  private readonly matrix = new Matrix4();
  private readonly point = new Vector3();
  begin(): void { this.figures.length = 0; }
  draw(): void { for (const figure of this.figures) figure.drawn = true; }
  add(id: number, clip: string, phase: number, instance: Matrix4, palette: CrowdPosePalette, frame: number, outgoing: number, weight: number): void {
    if (!this.enabled) return;
    const pose = palette.pose(frame, outgoing, weight);
    const feet = ['footL', 'footR'].map(name => {
      const part = palette.clip.parts.indexOf(name);
      if (part < 0) return [];
      this.matrix.fromArray(pose, part * 16);
      return this.point.setFromMatrixPosition(this.matrix).applyMatrix4(instance).toArray();
    });
    this.figures.push({ id, clip, phase, drawn: false, feet });
  }
}
