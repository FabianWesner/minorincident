import {PerspectiveCamera,Vector3} from 'three';
import {test,expect} from 'vitest';
import {RayCursor} from '../../../src/input/devices/RayCursor';
test('@E24 @E24-AC17 pointer aim projects onto the current authored floor',()=>{
  const camera=new PerspectiveCamera(25,1600/900,.1,1000);camera.position.set(24,29,24);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  const canvas={getBoundingClientRect:()=>({left:0,top:0,width:1600,height:900})} as HTMLElement,cursor=new RayCursor(camera,canvas);
  for(const height of [0,.6,3.9]){
    cursor.setGroundHeight(height);const target=new Vector3(4,height,6),ndc=target.clone().project(camera),hit=cursor.project((ndc.x+1)*800,(1-ndc.y)*450)!;
    expect(hit.distanceTo(target)).toBeLessThan(1e-8);
  }
});

test('@E29 cursor samples the height at the pointer across raised and lower ground without allocating a new hit', () => {
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 1000);
  camera.position.set(24, 29, 24); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 17, top: 23, width: 1600, height: 900 }) } as HTMLElement;
  const cursor = new RayCursor(camera, canvas);
  cursor.setHeightField((x) => x > 0 ? 3.9 : .05);
  for (const [x, height, playerFloor] of [[6, 3.9, 0], [-6, .05, 3.9], [8, 3.9, 3.9]]) {
    cursor.setGroundHeight(playerFloor);
    const target = new Vector3(x, height, 2), ndc = target.clone().project(camera);
    const hit = cursor.project(17 + (ndc.x + 1) * 800, 23 + (1 - ndc.y) * 450)!;
    expect(hit).toBe(cursor.point);
    expect(hit.distanceTo(target)).toBeLessThan(1e-8);
  }
});

test('@E29 cursor refines a sloped field three times', () => {
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 1000);
  camera.position.set(24, 29, 24); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } as HTMLElement;
  const cursor = new RayCursor(camera, canvas);
  cursor.setHeightField(x => .2 + x * .03);
  const target = new Vector3(4, .32, 6), ndc = target.clone().project(camera);
  expect(cursor.project((ndc.x + 1) * 800, (1 - ndc.y) * 450)!.distanceTo(target)).toBeLessThan(.001);
});

test('@E29 cursor finds the upper floor close to a cliff when the initial lower-plane hit falls past its edge', () => {
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 600);
  camera.position.set(244.76, 16.75, 11.38); camera.lookAt(228.46, 0, -4.92); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } as HTMLElement;
  const cursor = new RayCursor(camera, canvas); cursor.setGroundHeight(0);
  cursor.setHeightField((x, z) => x >= 85 && x <= 285 && z >= 2 && z <= 30 ? 3.9 : 0);
  const target = new Vector3(228.46, 3.9, 4), ndc = target.clone().project(camera);
  expect(cursor.project((ndc.x + 1) * 800, (1 - ndc.y) * 450)!.distanceTo(target)).toBeLessThan(.001);
});

test('@E29 cursor finds a small walkable plinth before the lower ground behind it', () => {
  const camera = new PerspectiveCamera(25, 1600 / 900, .1, 600);
  camera.position.set(-4, 8, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } as HTMLElement;
  const cursor = new RayCursor(camera, canvas);
  cursor.setHeightField((x, z) => Math.abs(x) <= .15 && Math.abs(z) <= .25 ? .4 : 0);
  const target = new Vector3(0, .4, 0), ndc = target.clone().project(camera);
  expect(cursor.project((ndc.x + 1) * 800, (1 - ndc.y) * 450)!.distanceTo(target)).toBeLessThan(.001);
});
