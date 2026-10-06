import { InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu';
import { color, uv, vec4 } from 'three/tsl';
import type { SimWorld } from '../sim/world/SimWorld';

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
  update(): void {
    this.count = 0;
    for (const entity of this.world.entities.iterate()) {
      // Infected use CrowdView's pooled footprint (including its culling and corpse policy).
      if (entity.hidden || entity.faction === 'infected' || !(entity.survivor || entity.civilian || entity.escort || entity.companion) || this.count === 512) continue;
      const pet = entity.companion || entity.civilian?.pet;
      this.transform.makeScale(pet ? .85 : 1, 1, pet ? .6 : .8);
      this.transform.setPosition(entity.transform.x, (this.world.districts?.groundHeight(entity.transform.x, entity.transform.z) ?? 0) + .022, entity.transform.z);
      this.setMatrixAt(this.count++, this.transform);
    }
    this.visible = this.count > 0; if (this.count) this.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.geometry.dispose(); (this.material as MeshBasicNodeMaterial).dispose(); super.dispose(); }
}
