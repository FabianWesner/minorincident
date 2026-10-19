import { Box3, BufferGeometry, Mesh, Vector3, type Object3D } from 'three/webgpu';

/** The corgi GLB's tongue primitive (pal_corgiTongue under the head joint). Tagged before the NPC material remap renames it. */
export function markCorgiTongue(root: Object3D): void {
  const tongues: Mesh[] = [], pinks: Mesh[] = [];
  root.traverse(node => {
    const mesh = node as Mesh; if (!mesh.isMesh) return;
    const names = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(m => m.name);
    let head = false; for (let p: Object3D | null = node; p; p = p.parent) if (p.name === 'head') head = true;
    if (head && names.includes('pal_corgiTongue')) { node.userData.corgiTongue = true; tongues.push(mesh); }
    else if (head && names.includes('pal_corgiPink')) pinks.push(mesh);
  });
  // The pink tongue groove shares the head's corgiPink primitive with the inner ears: move the triangles lying on the
  // tongue into their own mesh so they retract with it instead of hanging in the open mouth.
  for (const tongue of tongues) {
    const box = indexedBounds(tongue); if (!box) continue;
    const pad = new Vector3().subVectors(box.max, box.min).multiplyScalar(.15); box.min.sub(pad); box.max.add(pad);
    for (const pink of pinks) {
      if (pink.parent !== tongue.parent || !pink.geometry.index) continue;
      const index = pink.geometry.index, position = pink.geometry.getAttribute('position'), keep: number[] = [], groove: number[] = [], v = new Vector3();
      for (let i = 0; i < index.count; i += 3) {
        const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        (tri.every(k => box.containsPoint(v.fromBufferAttribute(position, k))) ? groove : keep).push(...tri);
      }
      if (!groove.length) continue;
      const split = new BufferGeometry(); for (const [name, attribute] of Object.entries(pink.geometry.attributes)) split.setAttribute(name, attribute);
      split.setIndex(groove); pink.geometry.setIndex(keep);
      const mesh = new Mesh(split, pink.material); mesh.name = 'tongue-groove'; mesh.position.copy(pink.position); mesh.quaternion.copy(pink.quaternion); mesh.scale.copy(pink.scale);
      mesh.userData.corgiTongue = true; pink.parent!.add(mesh);
    }
  }
}
function indexedBounds(mesh: Mesh): Box3 | null {
  const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index, box = new Box3(), v = new Vector3();
  const count = index ? index.count : position.count;
  for (let i = 0; i < count; i++) box.expandByPoint(v.fromBufferAttribute(position, index ? index.getX(i) : i));
  return box.isEmpty() ? null : box;
}

/** PO 10-19 ("Tongue of the dog is out all the time"): the tongue is static geometry in the asset, so it was always out.
 * It now pants while the corgi moves and for a few seconds after a run, and retracts into the mouth when it rests.
 * Presentation only; driven by sim time and the presented speed, so replays look identical. */
export class CorgiTongue {
  static readonly runSpeed = 2.5;
  static readonly moveSpeed = .6;
  static readonly afterRunSeconds = 4;
  private readonly parts: { mesh: Mesh; pivot: Vector3; position: Vector3; scale: Vector3 }[] = [];
  private pantUntil = -Infinity;
  private last = -1;
  /** 0 = retracted (hidden), 1 = fully out. */
  out = 0;
  constructor(root: Object3D) {
    const groups = new Map<Object3D | null, Mesh[]>();
    root.traverse(node => { if (node.userData.corgiTongue) groups.set(node.parent, [...groups.get(node.parent) ?? [], node as Mesh]); });
    for (const meshes of groups.values()) {
      // Tongue and groove share one root pivot: the rear (-X, the corgi faces +X) centre of their bounds, inside the mouth.
      const box = new Box3(); for (const mesh of meshes) { const b = indexedBounds(mesh); if (b) box.union(b); }
      if (box.isEmpty()) continue;
      const pivot = new Vector3(box.min.x, (box.min.y + box.max.y) / 2, (box.min.z + box.max.z) / 2);
      for (const mesh of meshes) this.parts.push({ mesh, pivot, position: mesh.position.clone(), scale: mesh.scale.clone() });
    }
    this.apply(0, 0);
  }
  get found(): boolean { return this.parts.length > 0; }
  update(time: number, speed: number): void {
    if (speed > CorgiTongue.runSpeed) this.pantUntil = time + CorgiTongue.afterRunSeconds;
    const target = speed > CorgiTongue.moveSpeed || time < this.pantUntil ? 1 : 0;
    const dt = this.last < 0 || time < this.last ? 0 : Math.min(.25, time - this.last); this.last = time;
    this.out += (target - this.out) * Math.min(1, dt * 5);
    if (dt === 0) this.out = target;
    this.apply(this.out, time);
  }
  private apply(out: number, time: number): void {
    // Panting: the out tongue flicks a little (2.6 Hz) instead of hanging still.
    const s = out < .05 ? 0 : out * (.9 + .1 * Math.sin(time * Math.PI * 2 * 2.6));
    const k = Math.max(s, 1e-3);
    // Scale about the pivot in the mesh's own frame: p' = pivot + k (p - pivot), composed with its authored transform.
    for (const { mesh, pivot, position, scale } of this.parts) {
      mesh.visible = s > 0;
      mesh.scale.copy(scale).multiplyScalar(k);
      mesh.position.copy(pivot).multiplyScalar(1 - k).multiply(scale).applyQuaternion(mesh.quaternion).add(position);
    }
  }
}
