import { expect, test } from 'vitest';
import { Box3, Group, Vector3 } from 'three';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { sampleClip } from '../../../src/render/characters/clips';
import { GunAim, gunCarryElevation, longGunHolds } from '../../../src/render/characters/GunAim';

// PO 10-12: "the way the player holds the MP looks wrong". Every long gun the
// courier can carry points along the aim, sits upright and is held in front of
// the chest's facing (not across it), with the support palm on the fore-end.
const assemble = (node: Node): Group => {
  const group = new Group(); group.name = node.getName();
  group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation()); group.scale.fromArray(node.getScale());
  for (const child of node.listChildren()) group.add(assemble(child));
  return group;
};
const load = async (path: string) => {
  const doc = await (await assetIO()).read(path), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  model.updateMatrixWorld(true);
  return { doc, model };
};
const deg = (radians: number) => radians * 180 / Math.PI;

for (const asset of Object.keys(longGunHolds)) test(`@long-guns ${asset}: asset frame is +X barrel, +Y up, support palm on the fore-end`, async () => {
  const { doc, model } = await load(`public/assets/models/${asset}.glb`);
  const at = (name: string) => model.getObjectByName(name)?.getWorldPosition(new Vector3());
  const grip = at('grip')!, muzzle = at('muzzle')!, magazine = at('magazine');
  const bounds = new Box3(); for (const node of doc.getRoot().listNodes()) if (node.getMesh()) bounds.expandByObject(model.getObjectByName(node.getName()) ?? new Group());
  // Muzzle at the front end, grip and magazine below the bore: a roll or a reversed asset fails here.
  expect(muzzle.x - grip.x).toBeGreaterThan(.3);
  expect(muzzle.y).toBeGreaterThan(grip.y);
  if (magazine) expect(magazine.y).toBeLessThan(muzzle.y);
  const hold = longGunHolds[asset];
  const palm = grip.x + hold.support[0];
  // The left palm sits ahead of the magazine / MG ammo box, under the fore-end.
  if (magazine) expect(palm - magazine.x, 'support palm ahead of the magazine').toBeGreaterThan(.12);
  // PO 10-12: "the left hand grips the ammo box". The MG's green box ends at x = .15 (asset side render).
  if (asset === 'wpn.machine-gun') expect(palm, 'MG palm ahead of the ammo box').toBeGreaterThan(.18);
  expect(palm).toBeLessThan(muzzle.x);
});

for (const variant of ['female', 'male']) test(`@long-guns ${variant}: every long gun points within 10 degrees of the aim, upright, in front of the chest's facing`, async () => {
  const { doc, model } = await load(`public/assets/models/char.courier-${variant}.skin.glb`);
  // Same bone-frame re-expression as alignSkeleton (see long-gun-hold.test.ts).
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
  for (const side of ['L', 'R']) { const socket = joint(`weaponSocket${side}`); if (socket.position.length() > .045) socket.position.setLength(.045); }
  const aim = new GunAim(joint('armR'), joint('foreArmR'), joint('handR'), joint('torso'), [joint('armL'), joint('foreArmL'), joint('handL')], [joint('weaponSocketR'), joint('weaponSocketL')], joint('head'));
  for (const [asset, hold] of Object.entries(longGunHolds)) {
    // Mounted like ActionView: grip at the socket, holder scaled by the hold.
    const gun = (await load(`public/assets/models/${asset}.glb`)).model, holder = new Group();
    gun.position.sub(gun.getObjectByName('grip')!.getWorldPosition(new Vector3()));
    holder.add(gun); holder.scale.setScalar(hold.scale); joint('weaponSocketR').add(holder);
    for (const clip of ['idle', 'walk', 'run']) for (const phase of [.1, .4, .8]) for (const yaw of [0, 1, 3]) for (const elevation of [gunCarryElevation(asset), 0]) for (const recoil of [0, .035]) {
      sampleClip(model, clip, phase); model.updateMatrixWorld(true);
      const direction = { x: Math.cos(yaw), z: Math.sin(yaw) };
      aim.apply(direction, undefined, elevation, .995 - recoil, true, 0, hold); model.updateMatrixWorld(true);
      const label = `${asset}/${clip}/${phase}/${yaw}/${elevation}`;
      const target = new Vector3(direction.x * Math.cos(elevation), Math.sin(elevation), direction.z * Math.cos(elevation));
      const barrel = new Vector3(1, 0, 0).transformDirection(gun.matrixWorld), up = new Vector3(0, 1, 0).transformDirection(gun.matrixWorld);
      expect(deg(barrel.angleTo(target)), `${label} muzzle direction`).toBeLessThan(10);
      // Sights up, magazine down: no roll about the barrel and no upside-down gun.
      expect(deg(up.angleTo(new Vector3(0, 1, 0))), `${label} up`).toBeLessThan(deg(Math.abs(elevation)) + 5);
      const muzzle = gun.getObjectByName('muzzle')!.getWorldPosition(new Vector3()), grip = joint('weaponSocketR').getWorldPosition(new Vector3());
      expect(muzzle.sub(grip).dot(target), `${label} muzzle ahead of the grip`).toBeGreaterThan(.15);
      // PO: the gun must not cross the body. The chest faces near the aim (a short blade only).
      const chest = new Vector3(1, 0, 0).transformDirection(joint('torso').matrixWorld).setY(0).normalize();
      expect(deg(chest.angleTo(new Vector3(direction.x, 0, direction.z))), `${label} chest vs aim`).toBeLessThan(asset === 'wpn.rocket-launcher' ? 50 : 30);
      expect(aim.contactGap, `${label} support palm`).toBeLessThan(.02);
    }
    holder.removeFromParent();
  }
});
