import { InstancedMesh, Matrix4, type BufferGeometry, type Material } from 'three/webgpu';

/** Keep every perimeter post, but traverse/cull nearby posts together. Small
 * spatial batches avoid submitting the whole town's fence at one camera. */
export function batchPerimeterPosts(points: readonly [number, number, number][], geometry: BufferGeometry, material: Material): InstancedMesh[] {
  const cells = new Map<string, [number, number, number][]>();
  for (const point of points) {
    const key = `${Math.floor(point[0] / 16)}:${Math.floor(point[2] / 16)}`;
    let cell = cells.get(key); if (!cell) { cell = []; cells.set(key, cell); }
    cell.push(point);
  }
  const matrix = new Matrix4();
  return [...cells.values()].map(cell => {
    const mesh = new InstancedMesh(geometry, material, cell.length);
    mesh.name = 'perimeter-posts'; mesh.castShadow = false; mesh.receiveShadow = true;
    cell.forEach((point, i) => mesh.setMatrixAt(i, matrix.makeTranslation(...point)));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.matrixAutoUpdate = false;
    return mesh;
  });
}
