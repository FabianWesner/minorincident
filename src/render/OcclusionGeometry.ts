import { BufferGeometry, Matrix4, Ray, Vector3, type Material, type Raycaster } from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

const trees = new WeakMap<BufferGeometry, MeshBVH>();
const inverse = new Matrix4(), localRay = new Ray(), point = new Vector3();

/** Static drawn triangles only. Build while loading and borrow immutable vertex
 * arrays; an independent index keeps BVH construction out of the render geometry. */
export function prepareOcclusionGeometry(source: BufferGeometry): MeshBVH | undefined {
  if ((source.index?.count ?? source.getAttribute('position').count) <= 192) return;
  let tree = trees.get(source);
  if (!tree) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', source.getAttribute('position'));
    geometry.setIndex(source.getIndex());
    geometry.groups = source.groups.map(group => ({ ...group }));
    geometry.drawRange = { ...source.drawRange };
    tree = new MeshBVH(geometry, { indirect: true });
    trees.set(source, tree);
  }
  return tree;
}

/** Same finite ray and material sides as Mesh.raycast, in the placement's local
 * space. Scale the range along this ray, including nonuniform placement scale. */
export function geometryOccludes(tree: MeshBVH, matrixWorld: Matrix4, material: Material | Material[], ray: Raycaster): boolean {
  inverse.copy(matrixWorld).invert();
  localRay.copy(ray.ray).applyMatrix4(inverse);
  point.copy(ray.ray.origin).add(ray.ray.direction).applyMatrix4(inverse);
  const scale = point.distanceTo(localRay.origin);
  return tree.raycastFirst(localRay, material, ray.near * scale, ray.far * scale) !== null;
}
