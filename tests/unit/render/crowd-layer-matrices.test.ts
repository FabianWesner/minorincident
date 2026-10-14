import { expect, test, vi } from 'vitest';
import { Group, Matrix4, Object3D, Vector3 } from 'three';
import { CrowdLocomotion, type CrowdLayers } from '../../../src/render/characters/CrowdLocomotion';

type Rig = { load(pose: Float32Array, instance: Matrix4, layers?: CrowdLayers, phase?: number): void; layer(layers: CrowdLayers, phase: number): void; frame: Group; nodes: Object3D[]; rig: { hip: Object3D } };
test('combined atlas and pose layers match two hierarchy expansions under scale, reflection and every human layer', () => {
  const model = new Group(), names = ['root', 'hip', 'torso', 'head', 'armL', 'armR', 'foreArmL', 'foreArmR', 'hat', 'pocket'];
  const parents = [-1, 0, 1, 2, 2, 2, 4, 5, 3, 2];
  const bones = names.map(name => { const bone = new Object3D(); bone.name = name; return bone; });
  bones.forEach((bone, i) => { (parents[i] < 0 ? model : bones[parents[i]]).add(bone); bone.position.set(i * .02, .2, -.03); });
  model.updateMatrixWorld(true);
  const clip = { parts: names, frames: 1, duration: 1, matrices: new Float32Array(names.length * 16) };
  const actual = new CrowdLocomotion(model.clone(true), clip) as unknown as Rig, expected = new CrowdLocomotion(model.clone(true), clip) as unknown as Rig;
  const instance = new Matrix4(), scale = new Vector3(), pose = new Float32Array(names.length * 16);
  for (const mirror of [-1, 1]) for (let step = 0; step < 40; step++) {
    bones.forEach((bone, i) => { bone.rotation.set(step * .02, i * .08, step * -.01); bone.scale.set(1 + i * .03, .9, 1.1); }); model.updateMatrixWorld(true);
    bones.forEach((bone, i) => bone.matrixWorld.toArray(pose, i * 16));
    instance.makeRotationY(step * .07).scale(scale.set(1.2 * mirror, .8, 1.1)).setPosition(3, 2, -4);
    const layers = { lean: .1, roll: -.05, lunge: Math.sin(step) * .1, lurch: .2, flinch: step % 3 / 3, hitX: -.7, hitZ: .2, throwPose: step % 4 / 4, chestBeat: step / 20 };
    expected.load(pose, instance); expected.layer(layers, step / 40); expected.rig.hip.updateMatrixWorld(true);
    const refresh = vi.spyOn(actual.frame, 'updateMatrixWorld'); actual.load(pose, instance, layers, step / 40); expect(refresh).toHaveBeenCalledOnce(); refresh.mockRestore();
    actual.nodes.forEach((bone, i) => bone.matrixWorld.elements.forEach((value, j) => expect(value).toBeCloseTo(expected.nodes[i].matrixWorld.elements[j], 12)));
  }
});
