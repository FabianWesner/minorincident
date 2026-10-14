import type { Object3D } from 'three';

/** After a translation-only edit to an already-current affine rig, retain its
 * linear transforms and recompute only world translation, in hierarchy order.
 * The rig's parent and every descendant local matrix must already be current. */
export function updateWorldTranslation(root: Object3D): void {
  root.updateMatrix();
  refresh(root);
}

function refresh(node: Object3D): void {
  const p = node.parent!.matrixWorld.elements, local = node.matrix.elements, world = node.matrixWorld.elements;
  world[12] = p[0] * local[12] + p[4] * local[13] + p[8] * local[14] + p[12] * local[15];
  world[13] = p[1] * local[12] + p[5] * local[13] + p[9] * local[14] + p[13] * local[15];
  world[14] = p[2] * local[12] + p[6] * local[13] + p[10] * local[14] + p[14] * local[15];
  node.matrixWorldNeedsUpdate = false;
  for (const child of node.children) refresh(child);
}
