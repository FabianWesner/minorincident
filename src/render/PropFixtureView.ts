import { BoxGeometry, Group, InstancedMesh, Object3D } from 'three/webgpu';
import type { SimWorld } from '../sim/world/SimWorld';
import type { Materials } from './Materials';
/** Code-shaped fixture visuals; campaign placements continue to use DistrictView's GLB batches. */
export class PropFixtureView extends Group {
  uploads = 0;
  private readonly box = new BoxGeometry(1, 1, 1);
  private readonly dummy = new Object3D();
  private readonly batch: InstancedMesh;
  private readonly poses: string[] = [];
  constructor(private readonly world: SimWorld, materials: Materials) {
    super(); this.batch = new InstancedMesh(this.box, materials.get('woodWarm'), world.props!.items.length); this.batch.castShadow = true; this.batch.receiveShadow = true; this.batch.frustumCulled = false; this.add(this.batch); this.update();
  }
  update(): void {
    this.uploads = 0;
    for (const [index, p] of this.world.props!.items.entries()) {
      const key = `${p.pose.p}/${p.pose.q}/${p.body.isEnabled()}`; if (this.poses[index] === key) continue;
      this.poses[index] = key; this.uploads++;
      this.dummy.position.set(p.pose.p[0], p.pose.p[1] + p.half[1], p.pose.p[2]); this.dummy.quaternion.fromArray(p.pose.q);
      this.dummy.scale.set(p.half[0] * 2, p.half[1] * 2, p.half[2] * 2).multiplyScalar(p.body.isEnabled() ? 1 : 0); this.dummy.updateMatrix(); this.batch.setMatrixAt(index, this.dummy.matrix);
    }
    if (this.uploads) this.batch.instanceMatrix.needsUpdate = true;
  }
  dispose(): void { this.box.dispose(); this.batch.dispose(); }
}
