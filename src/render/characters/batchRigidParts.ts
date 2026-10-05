import {
  Color,
  Float32BufferAttribute,
  Mesh,
  type Group,
  type Material,
  type MeshStandardMaterial,
} from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { palette, type PaletteToken } from "../../data/palette";

/** Merge rigid pieces within each joint, retaining the joint hierarchy and authored swatches.
 * Opt-in for E10's full-world draw-call budget; animation and gear attachment nodes stay intact.
 */
export function batchRigidParts(root: Group, material: Material): void {
  const parents: import("three").Object3D[] = [];
  root.traverse((node) => {
    if (node.children.some((child) => child instanceof Mesh))
      parents.push(node);
  });
  const oldMaterials = new Set<Material>();
  for (const parent of parents) {
    const meshes = parent.children.filter(
      (child): child is Mesh =>
        child instanceof Mesh &&
        !("isSkinnedMesh" in child) &&
        !Array.isArray(child.material),
    );
    if (meshes.length < 2) continue;
    const geometries = meshes.map((mesh) => {
      mesh.updateMatrix();
      const source = mesh.material as MeshStandardMaterial;
      const token = source.name.replace(/^pal_/, "") as PaletteToken;
      const color = ["survivorRed", "backpackTeal", "picketWhite"].includes(
        token,
      )
        ? new Color(palette[token])
        : source.color;
      const geometry = mesh.geometry.index
        ? mesh.geometry.toNonIndexed()
        : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrix);
      // Stylized shading uses positions/normals and swatches, not the imported UVs.
      for (const name of Object.keys(geometry.attributes))
        if (!["position", "normal"].includes(name))
          geometry.deleteAttribute(name);
      const colors = new Float32Array(
        geometry.getAttribute("position").count * 3,
      );
      for (let i = 0; i < colors.length; i += 3) {
        colors[i] = color.r;
        colors[i + 1] = color.g;
        colors[i + 2] = color.b;
      }
      geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
      oldMaterials.add(source);
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    if (!geometry)
      throw new Error(`Cannot batch rigid character joint ${parent.name}`);
    const batch = new Mesh(geometry, material);
    batch.name = `${parent.name}-rigid-batch`;
    batch.castShadow = batch.receiveShadow = true;
    parent.remove(...meshes);
    parent.add(batch);
    for (const g of geometries) g.dispose();
    for (const mesh of meshes) mesh.geometry.dispose();
  }
  // Single-mesh joints can still share an imported material with a merged joint.
  root.traverse((node) => {
    if (node instanceof Mesh)
      for (const m of Array.isArray(node.material)
        ? node.material
        : [node.material])
        oldMaterials.delete(m);
  });
  for (const m of oldMaterials) m.dispose();
}
