import { Mesh, Vector3, type Object3D, type BufferGeometry } from 'three/webgpu';
import type { DistrictLayout } from '../../levels/districts/types';

/** The inherited lake wall was merged into a palette mesh by the W0 bake, so
 * hiding a node by its collider id cannot remove its triangles. Cut only that
 * declared removed solid from the private W6 geometry; other levels retain it. */
export function removeL7LakeWall(root: Object3D, layout: DistrictLayout, removed: readonly string[]): BufferGeometry[] {
  const wall = layout.colliders.find(c => c.id.startsWith('dressing:lake-wall:') && removed.includes(c.id));
  if (!wall) return [];
  const { min, max } = wall.aabb, point = new Vector3(), owned: BufferGeometry[] = [];
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof Mesh) || node.userData.assetId) return;
    const geometry = node.geometry, position = geometry.getAttribute('position'), index = geometry.index;
    if (!position) return;
    const keep: number[] = [], size = index?.count ?? position.count;
    for (let i = 0; i < size; i += 3) {
      let inside = true;
      for (let j = 0; j < 3; j++) {
        point.fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(node.matrixWorld);
        inside &&= point.x >= min[0] - .01 && point.x <= max[0] + .01 && point.y >= min[1] - .01 && point.y <= max[1] + .01 && point.z >= min[2] - .01 && point.z <= max[2] + .01;
      }
      if (!inside) for (let j = 0; j < 3; j++) keep.push(index ? index.getX(i + j) : i + j);
    }
    if (keep.length < size) {
      const replacement = geometry.clone(); replacement.setIndex(keep);
      node.geometry = replacement; owned.push(replacement);
    }
  });
  return owned;
}
