import { InstancedMesh, Matrix4, type BufferGeometry, type Material } from 'three/webgpu';

/** Keep every perimeter post, but traverse/cull nearby posts together. Spatial
 * batches avoid submitting the whole town's fence at one camera.
 * Cell size (10-20, level handover): three builds one node graph per InstancedMesh (its cache key carries the object
 * uuid), so every cell costs a shader build at level load: 16 m cells meant 252 builds in L9 and 536 in L10, about a
 * third of those levels' loading-screen time. 128 m cells draw the same posts with 4-8x fewer builds and still skip far fences. */
export const perimeterCellSize = 128;
export function batchPerimeterPosts(points: readonly [number, number, number][], geometry: BufferGeometry, material: Material): InstancedMesh[] {
  const cells = new Map<string, [number, number, number][]>();
  for (const point of points) {
    const key = `${Math.floor(point[0] / perimeterCellSize)}:${Math.floor(point[2] / perimeterCellSize)}`;
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
