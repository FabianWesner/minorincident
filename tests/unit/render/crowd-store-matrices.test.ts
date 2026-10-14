import { expect, test, vi } from 'vitest';
import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { CrowdLocomotion } from '../../../src/render/characters/CrowdLocomotion';

test('yaw-frame pose storage matches full matrix products and scaled/tilted frames retain the general path', () => {
  const model = new Group(), names = ['hip', 'torso', 'head', 'armL', 'foreArmL', 'hat'];
  const parents = [-1, 0, 1, 1, 3, 2], bones = names.map(name => { const bone = new Object3D(); bone.name = name; return bone; });
  bones.forEach((bone, i) => { (parents[i] < 0 ? model : bones[parents[i]]).add(bone); bone.position.set(i / 20, .2, -.03); }); model.updateMatrixWorld(true);
  const clip = { parts: names, frames: 1, duration: 1, matrices: new Float32Array(names.length * 16) };
  const rig = new CrowdLocomotion(model, clip) as unknown as { load(pose: Float32Array, instance: Matrix4): void; store(pose: Float32Array, instance: Matrix4): void; nodes: Object3D[] };
  const instance = new Matrix4(), pose = new Float32Array(names.length * 16), actual = pose.slice(), expected = pose.slice(), inverse = new Matrix4(), product = new Matrix4();
  for (const general of [false, true]) for (let tick = 0; tick < 80; tick++) {
    bones.forEach((bone, i) => { bone.rotation.set(tick / 30, i / 10, -tick / 50); bone.scale.set(1 + i / 100, .9, 1.1); }); model.updateMatrixWorld(true);
    bones.forEach((bone, i) => bone.matrixWorld.toArray(pose, i * 16));
    instance.makeRotationY(tick / 11).setPosition(1000 + tick / 10, .7, -900);
    if (general) instance.multiply(new Matrix4().makeRotationX(.2)).scale(new Vector3(1.2, .8, -1.1));
    rig.load(pose, instance); inverse.copy(instance).invert();
    rig.nodes.forEach((node, i) => product.multiplyMatrices(inverse, node.matrixWorld).toArray(expected, i * 16));
    const multiply = vi.spyOn(Matrix4.prototype, 'multiplyMatrices'); rig.store(actual, instance);
    if (general) expect(multiply).toHaveBeenCalledTimes(bones.length); else expect(multiply).not.toHaveBeenCalled(); multiply.mockRestore();
    expect(actual).toEqual(expected);
  }
});
