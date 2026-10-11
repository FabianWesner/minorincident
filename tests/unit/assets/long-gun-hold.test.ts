import { expect, test } from 'vitest';
import { Group, Matrix4, Vector3 } from 'three';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { characterNodes } from '../../../src/data/survivor';
import { sampleClip } from '../../../src/render/characters/clips';
import { CrowdGunAim, GunAim, crowdLongGunHold, gunCarryElevation, longGunHolds } from '../../../src/render/characters/GunAim';

const assemble = (node: Node): Group => {
  const group = new Group(); group.name = node.getName();
  group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation()); group.scale.fromArray(node.getScale());
  for (const child of node.listChildren()) group.add(assemble(child));
  return group;
};
for (const variant of ['female', 'male']) test(`@long-guns ${variant}: support palm reaches every fitted fore-end through carry, turns and recoil without changing feet`, async () => {
  const doc = await (await assetIO()).read(`public/assets/models/char.courier-${variant}.skin.glb`), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  model.updateMatrixWorld(true);
  // Same bone-frame re-expression as alignSkeleton, without constructing render meshes.
  const bones = new Set(doc.getRoot().listSkins().flatMap(skin => skin.listJoints().map(joint => joint.getName())));
  const world = new Map<string, Vector3>();
  model.traverse(node => { if (bones.has(node.name)) world.set(node.name, node.getWorldPosition(new Vector3())); });
  model.traverse(node => {
    if (!bones.has(node.name)) return;
    node.quaternion.identity(); node.scale.set(1, 1, 1);
    node.parent!.updateWorldMatrix(true, false);
    node.position.copy(node.parent!.worldToLocal(world.get(node.name)!.clone())); node.updateWorldMatrix(false, true);
  });
  const joint = (name: string) => model.getObjectByName(name)!;
  for (const side of ['L', 'R']) {
    const socket = joint(`weaponSocket${side}`);
    if (socket.position.length() > .045) socket.position.setLength(.045);
  }
  const aim = new GunAim(joint('armR'), joint('foreArmR'), joint('handR'), joint('torso'), [joint('armL'), joint('foreArmL'), joint('handL')], [joint('weaponSocketR'), joint('weaponSocketL')], joint('head'));
  for (const [asset, hold] of Object.entries(longGunHolds)) for (const clip of ['idle', 'walk', 'run']) for (const phase of [.1, .4, .8]) for (const yaw of [0, 1, 3]) for (const recoil of [0, .035]) {
    sampleClip(model, clip, phase); model.updateMatrixWorld(true);
    const feet = ['footL', 'footR'].map(name => joint(name).matrixWorld.clone());
    const direction = { x: Math.cos(yaw), z: Math.sin(yaw) };
    for (const elevation of [gunCarryElevation(asset), 0]) {
      aim.apply(direction, undefined, elevation, .995 - recoil, true, 0, hold);
      expect(aim.contactGap, `${asset}/${clip}/${phase}/${yaw}/${elevation}`).toBeLessThan(.02);
      expect(new Vector3(1, 0, 0).transformDirection(joint('handR').matrixWorld).angleTo(new Vector3(direction.x * Math.cos(elevation), Math.sin(elevation), direction.z * Math.cos(elevation)))).toBeLessThan(.001);
      for (const [i, name] of ['footL', 'footR'].entries()) expect(joint(name).matrixWorld.elements).toEqual(feet[i].elements);
    }
  }
});

for (const asset of ['npc.national-guard', 'npc.police-officer', 'npc.civilian-man-a']) test(`@long-guns ${asset}: crowd palette keeps both palm contact and gait through carry and recoil`, async () => {
  const doc = await (await assetIO()).read(`public/assets/models/${asset}.glb`), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  const aim = new CrowdGunAim(model, [...characterNodes]);
  for (const clip of ['idle', 'walk', 'run']) for (const phase of [.1, .4, .8]) for (const yaw of [0, 1, 3]) for (const elevation of [-.18, 0]) for (const recoil of [0, .025]) {
    sampleClip(model, clip, phase); model.updateMatrixWorld(true);
    const pose = new Float32Array(characterNodes.length * 16);
    characterNodes.forEach((name, i) => model.getObjectByName(name)!.matrixWorld.toArray(pose, i * 16));
    const matrix = (name: typeof characterNodes[number]) => new Matrix4().fromArray(pose, characterNodes.indexOf(name) * 16);
    const feet = (['footL', 'footR'] as const).map(name => matrix(name).clone());
    aim.apply(pose, { x: Math.cos(yaw), z: Math.sin(yaw) }, elevation, .995 - recoil, crowdLongGunHold);
    const contact = new Vector3(...crowdLongGunHold.support).applyMatrix4(matrix('handR'));
    const palm = new Vector3().setFromMatrixPosition(matrix('weaponSocketL'));
    expect(palm.distanceTo(contact), `${asset}/${clip}/${phase}/${yaw}/${elevation}`).toBeLessThan(.02);
    for (const [i, name] of (['footL', 'footR'] as const).entries()) expect(matrix(name).elements).toEqual(feet[i].elements);
  }
});
