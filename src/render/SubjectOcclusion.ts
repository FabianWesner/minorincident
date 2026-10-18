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
