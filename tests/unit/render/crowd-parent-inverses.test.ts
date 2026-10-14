import { expect, test } from 'vitest';
import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';

test('shared parent inverses preserve the original crowd pose unpacking under scale and reflection', () => {
  const model = new Group();
  const names = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'hat', 'pocket'];
  const parents = [-1, 0, 1, 1, 1, 3, 4, 2, 1];
  const bones = names.map(name => { const bone = new Object3D(); bone.name = name; return bone; });
  bones.forEach((bone, i) => { (parents[i] < 0 ? model : bones[parents[i]]).add(bone); bone.position.set(i * .02, .2, -.03); });
  model.updateMatrixWorld(true);
  const clip = { parts: names, frames: 1, duration: 1, matrices: new Float32Array(names.length * 16) };
  const actual = new CrowdLocomotion(model, clip) as unknown as { load(pose: Float32Array, instance: Matrix4): void; nodes: Object3D[] };
  const expectedFrame = new Group(), expected = names.map(() => new Object3D());
  expected.forEach((bone, i) => (parents[i] < 0 ? expectedFrame : expected[parents[i]]).add(bone));
  const inverse = new Matrix4(), instance = new Matrix4(), scale = new Vector3();
  for (const mirror of [-1, 1]) for (let step = 0; step < 40; step++) {
    bones.forEach((bone, i) => { bone.rotation.set(step * .02, i * .08, step * -.01); bone.scale.set(1 + i * .03, .9, 1.1); });
    model.updateMatrixWorld(true);
    const world = bones.map(bone => bone.matrixWorld.clone());
    const pose = new Float32Array(names.length * 16);
    world.forEach((matrix, i) => matrix.toArray(pose, i * 16));
    // Match the Float32 atlas read before applying the original per-bone inverse.
    world.forEach((matrix, i) => matrix.fromArray(pose, i * 16));
    instance.makeRotationY(step * .07).scale(scale.set(1.2 * mirror, .8, 1.1)).setPosition(3, 2, -4);
    expected.forEach((bone, i) => {
      if (parents[i] < 0) inverse.identity(); else inverse.copy(world[parents[i]]).invert();
      inverse.multiply(world[i]).decompose(bone.position, bone.quaternion, bone.scale);
    });
    expectedFrame.matrixAutoUpdate = false; expectedFrame.matrix.copy(instance); expectedFrame.updateMatrixWorld(true);
    actual.load(pose, instance);
    actual.nodes.forEach((bone, i) => bone.matrixWorld.elements.forEach((value, component) => expect(value).toBeCloseTo(expected[i].matrixWorld.elements[component], bone.matrixAutoUpdate ? 12 : 5)));
  }
});
