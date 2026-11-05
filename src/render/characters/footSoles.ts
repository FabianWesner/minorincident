import { Box3, Matrix4, Mesh, Vector3, type Object3D } from 'three';

/** Reconstructed shoes may extend beyond the library's short heel/toe probes.
 * Store four sole corners in each foot's local bind frame, once per crowd batch. */
export function authoredSoles(root: Object3D): Vector3[][] | undefined {
  if (root.getObjectByName('root')?.userData.meshSoles !== true) return;
  const declared = root.getObjectByName('root')?.userData.soleBounds as number[][] | undefined;
  if (declared) return declared.map(b => [b[0], b[3]].flatMap(x => [b[2], b[5]].map(z => new Vector3(x, b[1], z))));
  root.updateMatrixWorld(true);
  return ['footL', 'footR'].map(name => {
    const foot = root.getObjectByName(name)!, inverse = new Matrix4().copy(foot.matrixWorld).invert();
    const bounds = new Box3(), point = new Vector3(), relative = new Matrix4();
    foot.traverse(node => {
      if (!(node instanceof Mesh) || !node.visible) return;
      relative.copy(inverse).multiply(node.matrixWorld);
      const p = node.geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) bounds.expandByPoint(point.fromBufferAttribute(p, i).applyMatrix4(relative));
    });
    return [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.z, bounds.max.z].map(z => new Vector3(x, bounds.min.y, z)));
  });
}
