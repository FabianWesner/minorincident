import { expect, test } from 'vitest';
import { Group, Matrix4, Vector3 } from 'three';
import type { Node } from '@gltf-transform/core';
import { assetIO } from '../../../tools/assets/io';
import { characterNodes } from '../../../src/data/survivor';
import { sampleClip } from '../../../src/render/characters/clips';
import { CrowdGunAim, GunAim } from '../../../src/render/characters/GunAim';
import { Vfx } from '../../../src/render/vfx/Vfx';
import { SimWorld } from '../../../src/sim/world/SimWorld';

const assemble = (node: Node): Group => {
  const group = new Group(); group.name = node.getName();
  group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation()); group.scale.fromArray(node.getScale());
  for (const child of node.listChildren()) group.add(assemble(child)); return group;
};
const load = async (name: string) => {
  const doc = await (await assetIO()).read(`public/assets/models/${name}.glb`), model = new Group();
  for (const node of doc.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  model.updateMatrixWorld(true); return model;
};
const point = (pose: Float32Array, name: string) => new Vector3().setFromMatrixPosition(new Matrix4().fromArray(pose, characterNodes.indexOf(name as typeof characterNodes[number]) * 16));

for (const archetype of ['char.courier-female.skin', 'char.courier-male.skin', 'npc.police-officer', 'npc.national-guard', 'npc.civilian-man-a', 'npc.civilian-woman-a']) {
  test(`@gun-pose ${archetype}: standing/walking firing arm is at shoulder height and points at the shot`, async () => {
    for (const scale of archetype.startsWith('char.') ? [1] : [1, 1.3]) {
    const model = await load(archetype), upper = model.getObjectByName('armR')!, middle = model.getObjectByName('foreArmR')!, hand = model.getObjectByName('handR')!;
    model.scale.setScalar(scale); model.updateMatrixWorld(true);
    const aim = new GunAim(upper, middle, hand,model.getObjectByName('torso')), crowd = new CrowdGunAim(model, [...characterNodes]);
    for (const clip of ['idle', 'walk']) for (const phase of [.1, .4, .8]) {
      sampleClip(model, clip, phase); model.updateMatrixWorld(true);
      const feet = ['footL','footR'].map(name => model.getObjectByName(name)!.matrixWorld.clone());
      if (archetype.startsWith('char.')) {
        const direction = new Vector3(.6, 0, .8); aim.apply(direction); model.updateMatrixWorld(true);
        const elbow = middle.getWorldPosition(new Vector3()), palm = hand.getWorldPosition(new Vector3());
        expect(Math.abs(palm.y - upper.getWorldPosition(new Vector3()).y)).toBeLessThan(.15);
        expect(palm.clone().sub(elbow).angleTo(direction) * 180 / Math.PI).toBeLessThan(15);
        expect(new Vector3(1,0,0).transformDirection(hand.matrixWorld).angleTo(direction)).toBeLessThan(.001);
      } else {
        const pose = new Float32Array(characterNodes.length * 16);
        characterNodes.forEach((name,i) => model.getObjectByName(name)!.matrixWorld.toArray(pose,i*16));
        crowd.apply(pose);
        expect(Math.abs(point(pose,'handR').y-point(pose,'armR').y)).toBeLessThan(.15);
        expect(point(pose,'handR').sub(point(pose,'foreArmR')).angleTo(new Vector3(1,0,0))*180/Math.PI).toBeLessThan(15);
        for (const [i,name] of ['footL','footR'].entries()) expect(new Matrix4().fromArray(pose,characterNodes.indexOf(name as typeof characterNodes[number])*16).elements).toEqual(feet[i].elements.map(Math.fround));
      }
      // The override must never touch the animated feet.
      for (const [i,name] of ['footL','footR'].entries()) expect(model.getObjectByName(name)!.matrixWorld.elements).toEqual(feet[i].elements);
    }
    }
  });
}

test('@gun-pose VFX flash and first tracer particle use the resolved muzzle, including walking shots', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1);
  const muzzle = { x: 1.23, y: 1.44, z: .22 };
  const vfx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {}, muzzle: () => muzzle });
  try {
    for (const sourceId of [1,2,3,4,5]) {
      world.events.emit(sourceId === 1 ? { type:'combat.attack', tick:world.tick, attackId:1, actionId:'weapon.handgun', combo:0, sourceId, side:'LEFT', position:{x:0,y:.7,z:0,yaw:0}, direction:{x:1,z:0} } : {type:'ally.attack',tick:world.tick,sourceId,targetId:99,role:'officer',from:{x:0,z:0},to:{x:10,z:0}});
      const shot = vfx.shots.at(-1)!;
      expect(shot.tracerStart).toEqual([muzzle.x,muzzle.y,muzzle.z]);
      const origins = vfx.particles.mesh.geometry.getAttribute('fxOrigin');
      const positions = Array.from({length:origins.count},(_,i)=>[origins.getX(i),origins.getY(i),origins.getZ(i)]);
      expect(positions.filter(p=>new Vector3(...p).distanceTo(new Vector3(muzzle.x,muzzle.y,muzzle.z))<.0001).length).toBeGreaterThanOrEqual(2);
      muzzle.x += .25;
    }
  } finally { vfx.dispose(); world.dispose(); }
});

test('@gun-pose courier and NPC firing poses still resolve with the user VFX preference off', async () => {
  const world = new SimWorld(); await world.init(); world.loadScenario('combat-arena', 1);
  const posed: number[] = [];
  const vfx = new Vfx(world, { flash() {}, detach() {}, blood() {}, clearGore() {}, shake() {}, muzzle: id => { posed.push(id); return { x: 1, y: 1, z: 0 }; } });
  try {
    vfx.set({ vfx: false });
    world.events.emit({ type:'combat.attack', tick:world.tick, attackId:1, actionId:'weapon.handgun', combo:0, sourceId:1, side:'LEFT', position:{x:0,y:.7,z:0,yaw:0}, direction:{x:1,z:0} });
    world.events.emit({ type:'ally.attack',tick:world.tick,sourceId:2,targetId:99,role:'officer',from:{x:0,z:0},to:{x:10,z:0} });
    expect(posed).toEqual([1, 2]);
    expect(vfx.visible).toBe(false);
    expect(vfx.shots).toHaveLength(0);
  } finally { vfx.dispose(); world.dispose(); }
});
