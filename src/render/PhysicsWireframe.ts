// Adapted from folio-2025 by Bruno Simon (MIT).
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, LineBasicNodeMaterial, LineSegments } from 'three/webgpu';
import type { Physics } from '../physics/Physics';

/** Debug-only collider lines; owns its GPU resources and releases them on unload. */
export class PhysicsWireframe {
  readonly geometry = new BufferGeometry();
  readonly material = new LineBasicNodeMaterial({ vertexColors: true });
  readonly lines = new LineSegments(this.geometry, this.material);
  constructor(private readonly physics: Physics) { this.lines.frustumCulled = false; this.material.depthTest = false; this.lines.renderOrder = 100; }
  private nextUpdate = 0;
  update(now = performance.now()): void {
    if (!this.physics.world || now < this.nextUpdate) return;
    this.nextUpdate = now + 100; // Debug geometry follows at 10 Hz, independently of render cadence.
    const { vertices, colors } = this.physics.world.debugRender();
    let position = this.geometry.getAttribute('position') as Float32BufferAttribute, color = this.geometry.getAttribute('color') as Float32BufferAttribute;
    const count = vertices.length / 3;
    if (!position || position.count < count) {
      // Grow geometrically: an arriving group must not dispose/recompile the lines per collider.
      const capacity = Math.max(1024, 2 ** Math.ceil(Math.log2(Math.max(1, count))));
      this.geometry.dispose();
      position = new Float32BufferAttribute(new Float32Array(capacity * 3), 3).setUsage(DynamicDrawUsage);
      color = new Float32BufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
      this.geometry.setAttribute('position', position); this.geometry.setAttribute('color', color);
    }
    position.array.set(vertices); color.array.set(colors);
    position.clearUpdateRanges(); position.addUpdateRange(0, vertices.length);
    color.clearUpdateRanges(); color.addUpdateRange(0, colors.length);
    position.needsUpdate = true; color.needsUpdate = true;
    this.geometry.setDrawRange(0, count);
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}
