import { Box3, Mesh, Vector3, type Object3D } from 'three';

/** Single-joint animal legs retain the authored rotations. A small positional
 * correction pins the paw during support, then eases away during swing. */
export class PawContacts {
  private readonly point = new Vector3();
  private readonly origin = new Vector3();
  private readonly offset = new Vector3();
  private readonly feet;
  constructor(private readonly root: Object3D, template = root) {
    template.updateWorldMatrix(true, true); template.getWorldPosition(this.origin);
    this.feet = ['legFL', 'legFR', 'legBL', 'legBR'].flatMap(name => {
      const leg = root.getObjectByName(name), original = template.getObjectByName(name); if (!leg || !original) return [];
      const bounds = new Box3(); original.traverse(node => { if (node instanceof Mesh) bounds.expandByObject(node); });
      if (bounds.isEmpty()) return [];
      const paw = bounds.getCenter(new Vector3()); paw.y = bounds.min.y;
      return [{ leg, paw: original.worldToLocal(paw), reach: bounds.max.y - bounds.min.y, sole: bounds.min.y - this.origin.y, planted: new Vector3(), correction: new Vector3(), release: new Vector3(), phase: -1 }];
    });
  }
  restore(): void { for (const foot of this.feet) { foot.leg.position.sub(foot.correction); foot.correction.set(0, 0, 0); } }
  reset(): void { for (const foot of this.feet) { foot.phase = -1; foot.release.set(0, 0, 0); } }
  stance(stride: number): number { return Math.min(.45, Math.min(...this.feet.map(f => f.reach)) * .75 / Math.max(.001, stride)); }
  update(phase: number, stride: number, clip: string): void {
    const offsets = clip === 'corgi-walk' ? [0, .5, .75, .25] : clip === 'corgi-gallop' ? [0, .1, .5, .6] : [0, .5, .5, 0];
    const stance = this.stance(stride); this.root.updateWorldMatrix(true, true); this.root.getWorldPosition(this.origin);
    for (const [index, foot] of this.feet.entries()) {
      const p = (phase + offsets[index]) % 1, fresh = foot.phase < 0 || p < foot.phase;
      if (fresh) {
        foot.planted.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld); foot.planted.y = this.origin.y + foot.sole;
      }
      if (p <= stance) {
        const target = foot.leg.parent!.worldToLocal(this.point.copy(foot.planted));
        foot.correction.copy(target).sub(this.offset.copy(foot.paw).multiply(foot.leg.scale).applyQuaternion(foot.leg.quaternion)).sub(foot.leg.position);
        foot.release.copy(foot.correction);
      } else {
        const fade = Math.max(0, 1 - (p - stance) / .15);
        foot.correction.copy(foot.release).multiplyScalar(fade * fade * (3 - 2 * fade));
      }
      foot.leg.position.add(foot.correction); foot.leg.updateWorldMatrix(false, true); foot.phase = p;
      // The authored gallop swing can still dip a paw under the floor: lift it back onto the sole plane.
      const dip = this.origin.y + foot.sole - this.point.copy(foot.paw).applyMatrix4(foot.leg.matrixWorld).y;
      if (dip > 0) {
        const parent = foot.leg.parent!, low = parent.worldToLocal(this.point.clone()), high = parent.worldToLocal(this.point.clone().setY(this.point.y + dip));
        high.sub(low); foot.leg.position.add(high); foot.correction.add(high); foot.leg.updateWorldMatrix(false, true);
      }
    }
  }
  points(): number[][] { this.root.updateWorldMatrix(true, true); return this.feet.map(f => this.point.copy(f.paw).applyMatrix4(f.leg.matrixWorld).toArray()); }
}
