import { Box3, Group, Mesh, Ray, Vector3, type PerspectiveCamera } from 'three/webgpu';
import type { PaletteMaterial } from './PaletteMaterial';

interface Building { group: Group; bounds: Box3; meshes: Mesh[]; roofs: Mesh[]; opacity: number; blocked: boolean }
/** Static building bounds, reusable ray temporaries and per-building owned materials. Roof cutaways when inside. */
export class Occlusion {
  private readonly buildings: Building[] = [];
  private readonly ray = new Ray();
  private readonly target = new Vector3();
  private readonly hit = new Vector3();
  visible = true;
  register(group: Group): void {
    group.updateWorldMatrix(true, true);
    const meshes: Mesh[] = [], roofs: Mesh[] = [];
    group.traverse((child) => { if (child instanceof Mesh) { meshes.push(child); if (child.userData.roof) roofs.push(child); } });
    this.buildings.push({ group, bounds: new Box3().setFromObject(group), meshes, roofs, opacity: 1, blocked: false });
  }
  update(camera: PerspectiveCamera, player: Vector3, seconds: number, playerMeshes: readonly Mesh[]): void {
    this.target.copy(player); this.target.y += 0.9;
    this.ray.origin.copy(camera.position); this.ray.direction.copy(this.target).sub(camera.position).normalize();
    const distance = camera.position.distanceTo(this.target);
    let blocked = false;
    for (const building of this.buildings) {
      const inside = player.x > building.bounds.min.x && player.x < building.bounds.max.x && player.z > building.bounds.min.z && player.z < building.bounds.max.z;
      const intersection = this.ray.intersectBox(building.bounds, this.hit);
      building.blocked = inside || Boolean(intersection && this.hit.distanceTo(camera.position) < distance);
      blocked ||= building.blocked;
      building.opacity += ((building.blocked ? 0.25 : 1) - building.opacity) * (1 - Math.exp(-16 * seconds));
      building.group.visible = this.visible;
      for (const mesh of building.meshes) { (mesh.material as PaletteMaterial).fade.value = building.opacity; }
      for (const roof of building.roofs) roof.visible = !inside;
    }
    // A presentation-only silhouette keeps the complete survivor readable through faded walls.
    for (const mesh of playerMeshes) { (mesh.material as PaletteMaterial).depthTest = !blocked; mesh.renderOrder = blocked ? 20 : 0; }
  }
  getState() { return this.buildings.map((b) => ({ name: b.group.name, opacity: b.opacity, blocked: b.blocked, roofsHidden: b.roofs.every((r) => !r.visible) })); }
  reset(): void { this.buildings.length = 0; this.visible = true; }
}
