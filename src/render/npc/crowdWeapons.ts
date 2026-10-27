import { BufferAttribute, BufferGeometry, Color, Matrix4, Mesh, Vector3, type Object3D } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CivilianProp } from '../../sim/npc/types';

export const crowdWeaponAssets = { rifle: 'wpn.assault-rifle', pistol: 'wpn.pistol', shotgun: 'wpn.shotgun', 'hunting-rifle': 'wpn.hunting-rifle' } as const;
export type CrowdGun = keyof typeof crowdWeaponAssets;
export function isCrowdGun(prop: CivilianProp): prop is CrowdGun { return prop in crowdWeaponAssets; }
/** Reuse the shipped weapon, with its authored grip at the palm socket. The
 * civilian pose uses +Z down the barrel; weapon assets use +X. One vertex-colour
 * batch per gun keeps the existing crowd draw count and owns its copied buffers. */
export function crowdWeaponGeometry(root: Object3D, scale: number): { geometry: BufferGeometry; muzzle: Vector3 } {
  root.updateMatrixWorld(true);
  const grip = root.getObjectByName('grip'), tip = root.getObjectByName('muzzle');
  if (!grip || !tip || root.userData.placeholder) throw new Error(`Missing crowd weapon grip/muzzle: ${root.userData.assetId}`);
  const origin = grip.getWorldPosition(new Vector3());
  const transform = new Matrix4().makeRotationY(-Math.PI / 2).scale(new Vector3(scale, scale, scale)).multiply(new Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
  const pieces: BufferGeometry[] = [];
  root.traverse(node => {
    if (!(node instanceof Mesh)) return;
    for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible) return;
    const source: BufferGeometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    const geometry = new BufferGeometry();
    for (const name of ['position', 'normal']) {
      const attribute = source.getAttribute(name), values = new Float32Array(attribute.count * attribute.itemSize);
      for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) values[i * attribute.itemSize + c] = attribute.getComponent(i, c);
      geometry.setAttribute(name, new BufferAttribute(values, attribute.itemSize));
    }
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const colors = new Float32Array(source.getAttribute('position').count * 3), vertexColors = source.getAttribute('color');
    for (let i = 0; i < colors.length / 3; i++) {
      const group = source.groups.find(g => i >= g.start && i < g.start + g.count);
      const material = materials[Array.isArray(node.material) ? group?.materialIndex ?? 0 : 0] as import('three').MeshStandardMaterial;
      const color = material.color?.clone() ?? new Color('white');
      if (material.vertexColors && vertexColors) color.multiply(new Color().fromBufferAttribute(vertexColors, i));
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.applyMatrix4(new Matrix4().multiplyMatrices(transform, node.matrixWorld));
    pieces.push(geometry); source.dispose();
  });
  const geometry = mergeGeometries(pieces)!; pieces.forEach(piece => piece.dispose()); geometry.computeBoundingBox();
  return { geometry, muzzle: tip.getWorldPosition(new Vector3()).applyMatrix4(transform) };
}
