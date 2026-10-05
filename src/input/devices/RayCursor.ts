// Adapted from folio-2025 RayCursor.js / Inputs/Nipple.js by Bruno Simon (MIT).
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
/** Scratch math objects are retained; input raycasts against the XZ plane, never scene meshes. */
export class RayCursor {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  readonly point = new Vector3();
  constructor(private readonly camera: Camera, private readonly element: HTMLElement) {}
  project(x: number, y: number): Vector3 | null {
    const rect = this.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray.intersectPlane(this.ground, this.point);
  }
}
