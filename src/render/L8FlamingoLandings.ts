import { DoubleSide, Group, InstancedMesh, Matrix4, MeshBasicNodeMaterial, RingGeometry } from 'three/webgpu';
import { l8FlamingoLanding, l8FlamingoLandingCount } from '../data/l8Bosses';
import type { SimWorld } from '../sim/world/SimWorld';

/** Fixed lit pads share their positions with the flock's walking destinations. */
export class L8FlamingoLandings extends Group {
  private readonly geometry = new RingGeometry(.55, .75, 24);
  private readonly material = new MeshBasicNodeMaterial({ color: 0xffd692, side: DoubleSide, transparent: true, opacity: .8, depthWrite: false });
  private readonly pads = new InstancedMesh(this.geometry, this.material, l8FlamingoLandingCount);
  constructor(world: SimWorld) {
    super();
    const pose = new Matrix4();
    for (let slot = 0; slot < l8FlamingoLandingCount; slot++) {
      const at = l8FlamingoLanding(slot);
      pose.makeRotationX(-Math.PI / 2);
      pose.setPosition(at.x, (world.districts?.groundHeight(at.x, at.z) ?? 0) + .065, at.z);
      this.pads.setMatrixAt(slot, pose);
    }
    this.add(this.pads);
  }
  dispose(): void { this.pads.dispose(); this.geometry.dispose(); this.material.dispose(); }
}
