import { Frustum, Matrix4, Sphere, Vector3, type Camera } from 'three/webgpu';
import { crowdLod } from './lodPolicy';

/** Shared render-only culling/LOD state. Simulation and animation remain independent. */
export class CrowdVisibility {
  private readonly frustum = new Frustum();
  private readonly projection = new Matrix4();
  private readonly bounds = new Sphere(new Vector3(), 1);
  private readonly point = new Vector3();
  private readonly bands = new Map<number, 'lod1' | 'lod2'>();
  private camera?: Camera;
  private height = 900;
  begin(camera?: Camera, height = 900): void {
    this.camera = camera; this.height = height;
    if (camera) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  pixels(x: number, y: number, z: number, height: number): number {
    if (!this.camera) return 200;
    this.point.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
    return height * this.camera.projectionMatrix.elements[5] * this.height / (2 * Math.max(.1, -this.point.z));
  }
  visible(x: number, y: number, z: number, radius: number): boolean {
    this.bounds.center.set(x, y, z); this.bounds.radius = radius;
    return !this.camera || this.frustum.intersectsSphere(this.bounds);
  }
  lod(id: number, pixels: number): 'lod1' | 'lod2' {
    const band = crowdLod(pixels, this.bands.get(id)); this.bands.set(id, band); return band;
  }
}
