import { expect, test, vi } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { sampleClip } from '../../../src/render/characters/clips';
import { GunAim, crowdLongGunHold, longGunHolds } from '../../../src/render/characters/GunAim';
import { ReferenceGunAim } from '../../fixtures/ReferenceGunAim';

function assemble(node: Node): Group {
  const group = new Group(); group.name = node.getName();
  group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation()); group.scale.fromArray(node.getScale());
  for (const child of node.listChildren()) group.add(assemble(child));
  return group;
}
function solver<T>(model: Object3D, Solver: new (...args: ConstructorParameters<typeof GunAim>) => T): T {
  const part = (name: string) => model.getObjectByName(name)!;
  return new Solver(part('armR'), part('foreArmR'), part('handR'), part('torso'), ['armL', 'foreArmL', 'handL'].map(part) as [Object3D, Object3D, Object3D], [part('handR'), part('weaponSocketL')], part('head'));
}
for (const asset of ['npc.national-guard', 'npc.police-officer', 'npc.civilian-man-a']) test(`${asset}: gun aiming reuses refreshed ancestors and preserves the original complete pose`, async () => {
  const doc = await (await assetIO()).read(`public/assets/models/${asset}.glb`), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  const copy = model.clone(true), actual = solver(model, GunAim), expected = solver(copy, ReferenceGunAim);
  const refresh = vi.spyOn(model, 'updateWorldMatrix');
  for (const clip of ['idle', 'walk', 'run']) for (const phase of [.1, .4, .8]) for (const yaw of [0, 1, 3]) for (const hold of [undefined, crowdLongGunHold, longGunHolds['wpn.assault-rifle']]) {
    sampleClip(model, clip, phase); sampleClip(copy, clip, phase);
    model.position.set(2, 1, -3); copy.position.copy(model.position);
    model.rotation.y = copy.rotation.y = .7;
    model.scale.set(1.1, .9, 1.2); copy.scale.copy(model.scale);
    const direction = { x: Math.cos(yaw), z: Math.sin(yaw) }, barrel = new Vector3(0, 0, 1);
    refresh.mockClear(); actual.apply(direction, barrel, -.18, .98, true, 0, hold);
    if (!hold?.protract) expect(refresh.mock.calls.length, 'world reads must not refresh ancestors after the torso/arm refresh').toBeLessThanOrEqual(2);
    expected.apply(direction, barrel, -.18, .98, true, 0, hold);
    const nodes: Object3D[] = [], others: Object3D[] = [];
    model.updateMatrixWorld(true); copy.updateMatrixWorld(true); model.traverse(n => nodes.push(n)); copy.traverse(n => others.push(n));
    nodes.forEach((node, i) => node.matrixWorld.elements.forEach((value, k) => expect(value).toBeCloseTo(others[i].matrixWorld.elements[k], 12)));
    expect(actual.contactGap).toBeCloseTo(expected.contactGap, 12);
  }
});
