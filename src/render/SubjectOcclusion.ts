import { Box3, Matrix4, Ray, Vector3 } from 'three/webgpu';

/** Camera segments against a vehicle's authored bounds, retaining its height and chassis rotation.
 * A shared screen disc alone also overlaps neighbouring cars that never hide the subject. */
export class SubjectOcclusion {
  private readonly points = Array.from({ length: 9 }, () => new Vector3());
  private readonly origin = new Vector3();
  private readonly inverse = new Matrix4();
  private readonly ray = new Ray();
  private readonly target = new Vector3();
  private readonly hit = new Vector3();

  setSubject(camera: Vector3, subject: Box3): void {
    this.origin.copy(camera);
    subject.getCenter(this.points[0]);
    let i = 1;
    for (const x of [subject.min.x, subject.max.x]) for (const y of [subject.min.y, subject.max.y]) for (const z of [subject.min.z, subject.max.z]) this.points[i++].set(x, y, z);
  }

  /** The courier's own chest (no corgi, no group union): an on-foot hull reveal needs the hull body to hide her torso,
   * not a padded subject corner beside the cab or a sparse roof rack over her shoulder (vqa-1 P1). */
  private readonly chest = new Vector3();
  private readonly body = new Box3();
  private coreSet = false;
  setCore(courier: Box3 | undefined): void {
    this.coreSet = !!courier;
    if (courier) this.chest.set((courier.min.x + courier.max.x) / 2, courier.min.y + 1.05, (courier.min.z + courier.max.z) / 2);
  }
  coreBlockedBy(bounds: Box3, matrix: Matrix4): boolean {
    if (!this.coreSet) return true;
    // Authored bounds include ladder racks, beacons and mirrors; the closed body ends about half a metre lower.
    this.body.copy(bounds); this.body.max.y -= Math.min(.5, (bounds.max.y - bounds.min.y) * .2);
    this.inverse.copy(matrix).invert();
    this.ray.origin.copy(this.origin).applyMatrix4(this.inverse);
    if (this.body.containsPoint(this.ray.origin)) return true;
    this.target.copy(this.chest).applyMatrix4(this.inverse);
    this.ray.direction.copy(this.target).sub(this.ray.origin);
    const distance = this.ray.direction.length();
    this.ray.direction.normalize();
    return !!this.ray.intersectBox(this.body, this.hit) && this.hit.distanceTo(this.ray.origin) < distance * .98;
  }

  blockedBy(bounds: Box3, matrix: Matrix4): boolean {
    this.inverse.copy(matrix).invert();
    this.ray.origin.copy(this.origin).applyMatrix4(this.inverse);
    if (bounds.containsPoint(this.ray.origin)) return true;
    for (const point of this.points) {
      this.target.copy(point).applyMatrix4(this.inverse);
      this.ray.direction.copy(this.target).sub(this.ray.origin);
      const distance = this.ray.direction.length();
      this.ray.direction.normalize();
      if (this.ray.intersectBox(bounds, this.hit) && this.hit.distanceTo(this.ray.origin) < distance * .98) return true;
    }
    return false;
  }
}
