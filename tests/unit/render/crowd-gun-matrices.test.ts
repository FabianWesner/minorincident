import { expect, test } from 'vitest';
import { Group, Matrix4, Object3D } from 'three';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { characterNodes } from '../../../src/data/survivor';
import { sampleClip } from '../../../src/render/characters/clips';
import { CrowdGunAim, crowdLongGunHold } from '../../../src/render/characters/GunAim';

function assemble(node: Node): Group {
  const group = new Group(); group.name = node.getName();
  group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation()); group.scale.fromArray(node.getScale());
  for (const child of node.listChildren()) group.add(assemble(child));
  return group;
}
for (const asset of ['npc.national-guard', 'npc.police-officer', 'npc.civilian-man-a']) test(`${asset}: upper-body aiming matches the complete skeleton solver exactly`, async () => {
  const doc = await (await assetIO()).read(`public/assets/models/${asset}.glb`), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  const actual = new CrowdGunAim(model, [...characterNodes]), expected = new CrowdGunAim(model, [...characterNodes]);
  const reference = expected as unknown as { nodes: Object3D[]; parents: number[]; load(pose: Float32Array): void };
  reference.nodes.forEach(node => { node.matrixAutoUpdate = true; node.matrixWorldAutoUpdate = true; });
  const matrix = new Matrix4(), parent = new Matrix4();
  reference.load = pose => reference.nodes.forEach((node, i) => {
    matrix.fromArray(pose, i * 16);
    if (reference.parents[i] >= 0) matrix.premultiply(parent.fromArray(pose, reference.parents[i] * 16).invert());
    matrix.decompose(node.position, node.quaternion, node.scale);
  });
  for (const clip of ['idle', 'walk', 'run']) for (const phase of [.1, .4, .8]) for (const yaw of [0, 1, 3]) {
    sampleClip(model, clip, phase); model.updateMatrixWorld(true);
    const pose = new Float32Array(characterNodes.length * 16);
    characterNodes.forEach((name, i) => model.getObjectByName(name)!.matrixWorld.toArray(pose, i * 16));
    for (const hold of [undefined, crowdLongGunHold]) {
      const a = pose.slice(), b = pose.slice(), direction = { x: Math.cos(yaw), z: Math.sin(yaw) };
      actual.apply(a, direction, -.18, .98, hold); expected.apply(b, direction, -.18, .98, hold);
      expect(a).toEqual(b);
    }
    const a = pose.slice(), b = pose.slice(); actual.hold(a, .5); expected.hold(b, .5); expect(a).toEqual(b);
  }
});
