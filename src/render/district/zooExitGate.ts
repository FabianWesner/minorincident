import { Group, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three/webgpu';

/** The W0 bake merges the steel leaves into its silver mesh. Split only the two
 * authored gate leaves, retaining the piers, lintel, material and shared source. */
export function zooExitGate(root: Object3D): { leaves: Group[]; geometry: BufferGeometry[] } {
  const leaves = [-1, 1].map(side => { const leaf = new Group(); leaf.name = `zoo-exit-leaf-${side}`; leaf.position.set(116, 0, 80 + side * 2.7); return leaf; });
  const owned: BufferGeometry[] = [], point = new Vector3();
  root.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  root.traverse(node => { if (node instanceof Mesh && !node.userData.assetId) meshes.push(node); });
  for (const node of meshes) {
    const geometry = node.geometry, position = geometry.getAttribute('position'), index = geometry.index;
    if (!position) continue;
    const keep: number[] = [], split: number[][] = [[], []], size = index?.count ?? position.count;
    for (let i = 0; i < size; i += 3) {
      let inside = true, z = 0;
      for (let j = 0; j < 3; j++) {
        point.fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(node.matrixWorld);
        inside &&= Math.abs(point.x - 116) <= .11 && point.y >= -.01 && point.y <= 3.06 && point.z >= 77.29 && point.z <= 82.71;
        z += point.z;
      }
      let side = z / 3 < 80 ? 0 : 1;
      // At the meeting plane, the outward normal identifies which leaf owns
      // its end cap; centroids alone would attach both caps to the right leaf.
      if (inside && Math.abs(z / 3 - 80) < .0001 && geometry.getAttribute('normal')) {
        point.fromBufferAttribute(geometry.getAttribute('normal'), index ? index.getX(i) : i).transformDirection(node.matrixWorld);
        side = point.z > 0 ? 0 : 1;
      }
      const into = inside ? split[side] : keep;
      for (let j = 0; j < 3; j++) into.push(index ? index.getX(i + j) : i + j);
    }
    if (keep.length === size) continue;
    const rest = geometry.clone(); rest.setIndex(keep); node.geometry = rest; owned.push(rest);
    split.forEach((indices, side) => {
      if (!indices.length) return;
      const indexed = geometry.clone(); indexed.setIndex(indices);
      const part = indexed.toNonIndexed(); indexed.dispose(); part.computeBoundingBox(); part.computeBoundingSphere(); owned.push(part);
      const mesh = new Mesh(part, node.material); mesh.applyMatrix4(node.matrixWorld); mesh.position.sub(leaves[side].position);
      mesh.castShadow = node.castShadow; mesh.receiveShadow = node.receiveShadow;
      leaves[side].add(mesh);
    });
  }
  for (const leaf of leaves) root.add(leaf);
  return { leaves, geometry: owned };
}

export function poseZooExitGate(leaves: readonly Group[], openness: number): void {
  leaves.forEach((leaf, index) => {
    if (leaf.userData.zooExitOpen === openness) return;
    leaf.userData.zooExitOpen = openness;
    leaf.traverse(node => { node.matrixWorldAutoUpdate = true; });
    leaf.rotation.y = (index ? -1 : 1) * Math.PI / 2 * Math.max(0, Math.min(1, openness));
    leaf.updateMatrix(); leaf.updateMatrixWorld(true);
  });
}
