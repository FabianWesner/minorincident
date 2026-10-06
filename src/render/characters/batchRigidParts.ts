import { BufferAttribute, BufferGeometry, Matrix4, Mesh, type Color, type Material, type Object3D } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Fold static Blender primitives within each animated joint. The joints and
 * sockets remain unchanged; their merged child still follows the same pivot. */
export function batchRigidParts(root: Object3D, parts: readonly string[], material: Material, swatch: (source: Material) => Color): void {
  root.updateMatrixWorld(true);
  const groups = new Map<Object3D, Mesh[]>(), oldGeometry = new Set<BufferGeometry>(), oldMaterials = new Set<Material>();
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible) return;
    let owner: Object3D | null = node;
    while (owner && !parts.includes(owner.name)) owner = owner.parent;
    if (!owner) return;
    if (!groups.has(owner)) groups.set(owner, []); groups.get(owner)!.push(node);
  });
  for (const [owner, meshes] of groups) {
    if (meshes.length < 2) continue;
    const inverse = owner.matrixWorld.clone().invert(), geometries: BufferGeometry[] = [];
    for (const mesh of meshes) {
      const geometry = new BufferGeometry(), source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      for (const name of ['position', 'normal']) {
        const attribute = mesh.geometry.getAttribute(name), values = new Float32Array(attribute.count * attribute.itemSize);
        for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
        geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
      }
      if (mesh.geometry.index) geometry.setIndex(mesh.geometry.index.clone());
      geometry.applyMatrix4(new Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
      const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3), color = swatch(source).toArray();
      for (let i = 0; i < count; i++) colors.set(color, i * 3);
      geometry.setAttribute('color', new BufferAttribute(colors, 3)); geometries.push(geometry);
      oldGeometry.add(mesh.geometry); for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) oldMaterials.add(m);
    }
    if (geometries.some(g => g.index)) for (const g of geometries) if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
    const geometry = mergeGeometries(geometries)!; for (const g of geometries) g.dispose();
    if (owner instanceof Mesh) { owner.geometry = geometry; owner.material = material; }
    else { const mesh = new Mesh(geometry, material); mesh.name = 'rigid-part'; mesh.castShadow = mesh.receiveShadow = true; owner.add(mesh); }
    for (const mesh of meshes) if (mesh !== owner) mesh.removeFromParent();
  }
  const keptGeometry = new Set<BufferGeometry>(), keptMaterials = new Set<Material>();
  root.traverse(node => { if (node instanceof Mesh) { keptGeometry.add(node.geometry); for (const m of Array.isArray(node.material) ? node.material : [node.material]) keptMaterials.add(m); } });
  for (const geometry of oldGeometry) if (!keptGeometry.has(geometry)) geometry.dispose();
  for (const source of oldMaterials) if (!keptMaterials.has(source)) source.dispose();
}
