import { expect, test } from 'vitest';
import { Group, Matrix4, Object3D } from 'three';
import { CrowdLocomotion, type CrowdLayers } from '../../../src/render/characters/CrowdLocomotion';

test('ordinary arms retain atlas transforms while throw and chest-beat layers keep the full joint solve', () => {
  const names = ['hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'handL', 'handR'];
  const parents = [-1, 0, 1, 1, 1, 3, 4, 5, 6], model = new Group(), bones = names.map(name => { const node = new Object3D(); node.name = name; return node; });
  bones.forEach((node, i) => { (parents[i] < 0 ? model : bones[parents[i]]).add(node); node.position.set(i / 20, .2, -.03); });
  model.updateMatrixWorld(true);
  const clip = { parts: names, frames: 1, duration: 1, matrices: new Float32Array(names.length * 16) };
  const mirror = new CrowdLocomotion(model, clip) as unknown as { load(pose: Float32Array, instance: Matrix4, layers?: CrowdLayers, phase?: number): void; nodes: Object3D[] };
  const instance = new Matrix4(), pose = new Float32Array(names.length * 16), local = new Matrix4(), parent = new Matrix4(), expected = new Group(), reference = bones.map(b => { const n = new Object3D(); n.name = b.name; return n; });
  reference.forEach((node, i) => (parents[i] < 0 ? expected : reference[parents[i]]).add(node));
  for (let tick = 0; tick < 50; tick++) {
    bones.forEach((node, i) => { node.rotation.set(tick / 30, i / 10, tick / 50); node.scale.set(1.1, .9, 1.05); }); model.updateMatrixWorld(true);
    bones.forEach((node, i) => node.matrixWorld.toArray(pose, i * 16));
    instance.makeRotationY(tick / 10).setPosition(1000, .7, -900);
    mirror.load(pose, instance);
    for (const name of ['armL', 'armR', 'foreArmL', 'foreArmR']) expect(mirror.nodes[names.indexOf(name)].matrixAutoUpdate).toBe(false);
    reference.forEach((node, i) => { local.fromArray(pose, i * 16); if (parents[i] >= 0) local.premultiply(parent.fromArray(pose, parents[i] * 16).invert()); local.decompose(node.position, node.quaternion, node.scale); });
    expected.matrixAutoUpdate = false; expected.matrix.copy(instance); expected.updateMatrixWorld(true);
    mirror.nodes.forEach((node, i) => node.matrixWorld.elements.forEach((value, j) => expect(Math.abs(value - reference[i].matrixWorld.elements[j])).toBeLessThan(1e-5)));
    mirror.load(pose, instance, { throwPose: .5, chestBeat: .2 }, .3);
    for (const name of ['armL', 'armR', 'foreArmL', 'foreArmR']) expect(mirror.nodes[names.indexOf(name)].matrixAutoUpdate).toBe(true);
  }
});
