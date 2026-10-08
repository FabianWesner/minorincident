import { InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { color, uv, vec4 } from 'three/tsl';
import type { SimWorld } from '../sim/world/SimWorld';
import { MotionPresentation } from './characters/MotionPresentation';

/** A smooth radial footprint, shared by all figure types; one draw for companions and humans. */
export function contactShadowMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  material.name = 'keep_contactShadow';
  const opacity = uv().sub(.5).length().mul(2).smoothstep(.12, 1).oneMinus().pow(2).mul(.3);
  material.outputNode = vec4(color('#50375f'), opacity);
  return material;
}
export class ContactShadows extends InstancedMesh {
  private readonly transform = new Matrix4();
  constructor(private readonly world: SimWorld) {
    const geometry = new PlaneGeometry(1.4, 1.4); geometry.rotateX(-Math.PI / 2);
    super(geometry, contactShadowMaterial(), 512);
    this.name = 'figure-contact-shadows'; this.frustumCulled = false; this.count = 0;
  }
  private readonly presentation = new MotionPresentation();
  /** Footprints sit under the presented (alpha-interpolated) figures, not their tick transforms, or they stair-step under them. */
  update(alpha = 1): void {
    this.count = 0;
    for (const entity of this.world.entities.iterate()) {
      // Infected use CrowdView's pooled footprint (including its culling and corpse policy).
      if (entity.hidden || entity.faction === 'infected' || !(entity.survivor || entity.civilian || entity.escort || entity.companion) || this.count === 512) continue;
      const pet = entity.companion || entity.civilian?.pet;
      this.transform.makeScale(pet ? .85 : 1, 1, pet ? .6 : .8);
      const previous = entity.id === 1 ? this.world.previousPlayer : null, t = entity.transform;
      const at = previous ? { x: previous.x + (t.x - previous.x) * alpha, z: previous.z + (t.z - previous.z) * alpha } : this.presentation.sample(entity.id, t, this.world.tick, alpha);
      this.transform.setPosition(at.x, (this.world.districts?.groundHeight(at.x, at.z) ?? 0) + .022, at.z);
      this.setMatrixAt(this.count++, this.transform);
    }
    this.visible = this.count > 0; if (this.count) this.instanceMatrix.needsUpdate = true;
  }
  /** First footprints' world positions (x, z), for presentation tests. */
  getState() { return Array.from({ length: Math.min(this.count, 8) }, (_, i) => { this.getMatrixAt(i, this.transform); return [this.transform.elements[12], this.transform.elements[14]]; }); }
  dispose(): void { this.geometry.dispose(); (this.material as MeshBasicNodeMaterial).dispose(); super.dispose(); }
}
