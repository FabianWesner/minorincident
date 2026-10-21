import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Group, Scene, Vector3, type WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ActionView } from '../../../src/render/ActionView';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { action } from '../../../src/data/actions/catalog';
import type { CharacterView } from '../../../src/render/characters/CharacterView';

test('PO #95 actual pipe bomb sits at the palm and has bottle-sized held bounds', async () => {
  const world=new SimWorld();await world.init();world.loadScenario('combat-arena');
  world.combat!.setLoadout(['weapon.pipe-bomb'],['weapon.pipe-bomb']);
  const hand=new Group(),socket=new Group();socket.name='weaponSocketR';hand.add(socket);hand.position.set(2,1.2,3);
  const character=Object.assign(new Group(),{rideWeight:0,socket:()=>({hand,socket}),node:()=>null});character.add(hand);
  const lighting=new Lighting(new Scene()),materials=new Materials(lighting);
  const view=new ActionView(world,character as unknown as CharacterView,materials,undefined as unknown as WebGPURenderer);
  try{
    const bytes=readFileSync('public/assets/models/thr.pipe-bomb.glb');
    const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
    (view as unknown as {register(def:ReturnType<typeof action>,model:Group):void}).register(action('weapon.pipe-bomb'),model);
    view.update();character.updateMatrixWorld(true);
    const held=socket.children.find(o=>o.visible)!;
    const size=new Box3().setFromObject(held).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(.3);expect(size.x).toBeLessThan(.45);
    expect(size.y).toBeLessThan(.2);expect(size.z).toBeLessThan(.22);
    expect(held.getObjectByName('grip')!.getWorldPosition(new Vector3()).distanceTo(socket.getWorldPosition(new Vector3()))).toBeLessThan(.001);
    expect(view.getState().attachments.find(a=>a.visible)).toMatchObject({actionId:'weapon.pipe-bomb',socket:'weaponSocketR',attached:true,gripDistance:0});
  }finally{view.dispose();world.dispose();materials.dispose();lighting.dispose();}
});
