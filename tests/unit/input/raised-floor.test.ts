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
