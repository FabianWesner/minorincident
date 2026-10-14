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
  private lodCamera?: Camera;
  private height = 900;
  begin(camera?: Camera, height = 900, lodCamera = camera): void {
    this.camera = camera; this.lodCamera = lodCamera; this.height = height;
    if (camera) this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  }
  pixels(x: number, y: number, z: number, height: number): number {
    if (!this.lodCamera) return 200;
    this.point.set(x, y, z).applyMatrix4(this.lodCamera.matrixWorldInverse);
    return height * this.lodCamera.projectionMatrix.elements[5] * this.height / (2 * Math.max(.1, -this.point.z));
  }
  /** Animation detail follows the pixels actually drawn, including wide inspection cameras. */
  renderPixels(x: number, y: number, z: number, height: number): number {
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
  /** Close figures drawn with the full model this frame (picked by the owner), and the models whose LOD0 is loaded. */
  readonly heroes = new Set<number>();
  /** E18 far-crowd budget: figures beyond the per-frame near-detail budget draw the far LOD2 (picked by the owner). */
  readonly demoted = new Set<number>();
  readonly heroModels = new Set<string>();
  /** The detail band of a figure: a hero with its LOD0 loaded draws lod0, everyone else the pixel band. */
  band(id: number, pixels: number, model: string): 'lod0' | 'lod1' | 'lod2' {
    const band = this.demoted.has(id) ? 'lod2' : this.lod(id, pixels);
    return band === 'lod1' && this.heroes.has(id) && this.heroModels.has(model) ? 'lod0' : band;
  }
}
