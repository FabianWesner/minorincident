import { Color, DataTexture, EquirectangularReflectionMapping, FloatType, PMREMGenerator, RGBAFormat, type RenderTarget, type WebGPURenderer } from 'three/webgpu';
import { timeOfDay, type TimeOfDay } from '../../data/timeOfDay';

/** Small authored sky/horizon/sun environment, prefiltered once per preset.
 * No scene capture or reflection render occurs during gameplay. */
export class Environment {
  private readonly cache = new Map<TimeOfDay, RenderTarget>();
  private readonly generator: PMREMGenerator;
  constructor(renderer: WebGPURenderer) { this.generator = new PMREMGenerator(renderer); }
  get(preset: TimeOfDay): RenderTarget {
    const cached = this.cache.get(preset); if (cached) return cached;
    const width = 256, height = 128, values = new Float32Array(width * height * 4), p = timeOfDay[preset];
    const sky = new Color(p.sky), ground = new Color(p.shadow), sun = new Color(p.sun), color = new Color();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const theta = y / height * Math.PI, phi = x / width * Math.PI * 2;
      const dot = Math.sin(theta) * Math.sin(p.polar) * Math.cos(phi - p.azimuth) + Math.cos(theta) * Math.cos(p.polar);
      color.copy(ground).lerp(sky, Math.max(0, Math.cos(theta)));
      const glint = Math.max(0, dot) ** 100 * p.intensity * 5;
      const index = (y * width + x) * 4; values.set([color.r + sun.r * glint, color.g + sun.g * glint, color.b + sun.b * glint, 1], index);
    }
    const source = new DataTexture(values, width, height, RGBAFormat, FloatType); source.mapping = EquirectangularReflectionMapping; source.needsUpdate = true;
    const target = this.generator.fromEquirectangular(source); source.dispose(); this.cache.set(preset, target); return target;
  }
  dispose(): void { for (const target of this.cache.values()) target.dispose(); this.generator.dispose(); }
}
