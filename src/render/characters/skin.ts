import { Bone, Matrix4, Quaternion, SkinnedMesh, Vector3, type Object3D } from 'three';

/** Skinned-figure pilot (?skin=1). Blender exports bones with their own rest axes (Y along the bone);
 * the authored library clips and the rigid contract use axis-aligned joint frames (identity rest
 * rotation in the asset frame). Re-express every bone in that frame at the same joint position and
 * rebind, so KeyframeAnimator, sockets, gear and stride scaling work unchanged. Returns the skinned meshes. */
export function alignSkeleton(model: Object3D): SkinnedMesh[] {
  model.updateMatrixWorld(true);
  const meshes: SkinnedMesh[] = [], bones: Bone[] = [];
  model.traverse(node => { if (node instanceof SkinnedMesh) meshes.push(node); if (node instanceof Bone) bones.push(node); });
  if (!meshes.length) return meshes;
  const world = new Map(bones.map(bone => [bone, bone.getWorldPosition(new Vector3())]));
  const inverse = new Matrix4(), frame = new Quaternion();
  // Parents precede children in traverse order: each parent is already re-expressed.
  for (const bone of bones) {
    const parent = bone.parent!;
    parent.updateMatrixWorld(true);
    const parentRotation = parent.getWorldQuaternion(frame);
    // Root bone: target frame is the asset frame (the armature node's frame), i.e. identity relative to it.
    bone.quaternion.identity();
    if (!(parent instanceof Bone)) bone.quaternion.copy(parentRotation).invert().multiply(model.getWorldQuaternion(new Quaternion()));
    bone.scale.set(1, 1, 1);
    bone.position.copy(world.get(bone)!).applyMatrix4(inverse.copy(parent.matrixWorld).invert());
    bone.updateMatrixWorld(true);
  }
  for (const mesh of meshes) {
    mesh.skeleton.calculateInverses();
    mesh.bind(mesh.skeleton, mesh.matrixWorld);
    // Posed limbs leave the bind-pose bounds; a single hero mesh is cheaper to draw than to cull wrongly.
    mesh.frustumCulled = false;
  }
  return meshes;
}
