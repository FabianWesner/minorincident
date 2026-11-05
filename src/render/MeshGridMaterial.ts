// Adapted from folio-2025 by Bruno Simon (MIT).
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { clamp, color, float, mix, positionWorld, smoothstep } from 'three/tsl';

/** Trimmed Bruno antialiased world-XZ grid; no palette/rendering features from E02. */
export class MeshGridMaterial extends MeshBasicNodeMaterial {
  constructor() {
    super();
    const uv = positionWorld.xz;
    const derivative = uv.fwidth();
    const lineWidth = float(0.02);
    const drawWidth = clamp(lineWidth, derivative, 1);
    const aa = derivative.mul(1.5);
    const gridUv = uv.fract().mul(2).sub(1).abs().oneMinus();
    const grid = smoothstep(drawWidth.add(aa), drawWidth.sub(aa), gridUv).mul(clamp(lineWidth.div(drawWidth), 0, 1));
    this.colorNode = mix(color('#577461'), color('#a0baa3'), grid.x.max(grid.y));
  }
}
