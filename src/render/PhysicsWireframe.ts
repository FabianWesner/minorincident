// Adapted from folio-2025 by Bruno Simon (MIT).
import { BufferGeometry, Float32BufferAttribute, LineBasicNodeMaterial, LineSegments } from 'three/webgpu';
import type { Physics } from '../physics/Physics';

/** Debug-only collider lines; owns its GPU resources and releases them on unload. */
export class PhysicsWireframe {
  readonly geometry = new BufferGeometry();
  readonly material = new LineBasicNodeMaterial({ vertexColors: true });
  readonly lines = new LineSegments(this.geometry, this.material);
  constructor(private readonly physics: Physics) { this.lines.frustumCulled = false; this.material.depthTest = false; this.lines.renderOrder = 100; }
  update(): void {
    if (!this.physics.world) return;
    const { vertices, colors } = this.physics.world.debugRender();
    const position = this.geometry.getAttribute('position'), color = this.geometry.getAttribute('color');
    if (position?.array.length === vertices.length && color?.array.length === colors.length) {
      position.array.set(vertices); color.array.set(colors);
      position.needsUpdate = true; color.needsUpdate = true;
    } else {
      this.geometry.dispose();
      this.geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      this.geometry.setAttribute('color', new Float32BufferAttribute(colors, 4));
    }
  }
  dispose(): void { this.geometry.dispose(); this.material.dispose(); }
}
