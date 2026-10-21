// Adapted from folio-2025 by Bruno Simon (MIT).
// Source: RayCursor.js / Inputs/Nipple.js, commit 41046b5.
import { Plane, Raycaster, Vector2, Vector3, type Camera } from 'three';
/** Retained scratch math refines the pointer against height-field planes, never scene meshes. */
export class RayCursor {
  private readonly raycaster = new Raycaster();
  private readonly ndc = new Vector2();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private heightAt?: (x: number, z: number) => number;
  readonly point = new Vector3();
  constructor(private readonly camera: Camera, private readonly element: HTMLElement) {}
  /** Fixed floor in flat scenes; lower-bound hint for height-field queries. */
  setGroundHeight(height: number): void { this.ground.constant = -height; }
  /** Retain the non-negative district height field; no mesh raycasts or scratch allocations. */
  setHeightField(heightAt: (x: number, z: number) => number): void { this.heightAt = heightAt; }
  project(x: number, y: number): Vector3 | null {
    const rect = this.element.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    this.ndc.set((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2);
    this.camera.updateMatrixWorld(); this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;
    // District height fields are non-negative. Seed from the first surface on
    // the ray: a lower-plane hit can lie beyond a raised edge or a small plinth.
    if (this.heightAt) this.ground.constant = Math.max(0, this.ground.constant);
    if (!ray.intersectPlane(this.ground, this.point)) return null;
    if (this.heightAt) {
      const distance = ray.origin.distanceTo(this.point), probes = Math.min(512, Math.ceil(distance / .1));
      for (let i = 1; i <= probes; i++) {
        const t = distance * i / probes;
        const height = this.heightAt(ray.origin.x + ray.direction.x * t, ray.origin.z + ray.direction.z * t);
        if (height >= ray.origin.y + ray.direction.y * t) {
          this.ground.constant = -height;
          if (!ray.intersectPlane(this.ground, this.point)) return null;
          break;
        }
      }
    }
    if (this.heightAt) for (let i = 0; i < 3; i++) {
      const height = this.heightAt(this.point.x, this.point.z);
      if (Math.abs(height - this.point.y) < 1e-5) break;
      this.ground.constant = -height;
      if (!ray.intersectPlane(this.ground, this.point)) return null;
    }
    return this.point;
  }
}
