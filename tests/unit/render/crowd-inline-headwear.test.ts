import { expect, test } from 'vitest';
import { BoxGeometry, BufferAttribute, InstancedMesh, Matrix4, MeshLambertNodeMaterial, Vector3 } from 'three/webgpu';
import { CrowdAccessories } from '../../../src/render/characters/CrowdAccessories';
import type { CrowdPosePalette } from '../../../src/render/characters/CrowdPosePalette';
import type { EntitySnapshot } from '../../../src/sim/world/types';
function fixture() {
  const accessories = new CrowdAccessories(), ids = ['acc.hat-baseball-cap','acc.hair-short-crop'];
  accessories.ids.splice(0,accessories.ids.length,...ids);
  const batches = (accessories as unknown as {batches:Map<string,InstancedMesh>}).batches;
  const body = new BoxGeometry(.3,.4,.2);body.deleteAttribute('uv');body.setAttribute('color',new BufferAttribute(new Float32Array(body.getAttribute('position').count*3).fill(.4),3));body.setAttribute('_parts',new BufferAttribute(new Float32Array(body.getAttribute('position').count*4),4));
  for(const id of ids){const g=new BoxGeometry(.2,.1,.25);g.setAttribute('color',new BufferAttribute(new Float32Array(g.getAttribute('position').count*3).fill(.6),3));batches.set(`${id}:lod1`,new InstancedMesh(g,new MeshLambertNodeMaterial(),350));}
  const entity = (id=77,accessory=ids[0]) => ({id,archetype:'infected.runner',faction:'infected',infected:{variant:'inf.common-worker'},appearance:{asset:'npc.civilian-man-a',accessories:[accessory],entityId:id,bornInfected:true,tint:'#ffffff'}} as unknown as EntitySnapshot);
  return {accessories,ids,batches,body,entity};
}
test('T-E07-12-headwear @E07 optional live slots preserve the original corpse body and fitted selected-piece geometry',()=>{
  const {accessories,body,entity}=fixture(), count=body.getAttribute('position').count;
  const corpse=accessories.corpseSource(entity(),body,'npc.civilian-man-a',0), selected=corpse.userData.corpseAccessory as BoxGeometry;
  const live=accessories.livingSource(body,'npc.civilian-man-a',0), parts=live.getAttribute('_parts');
  expect(live.userData.inlineBody).toBe(body);expect(live.userData.inlineAccessories).toBe(true);
  expect(live.getAttribute('position').count).toBe(count+2*24);expect(live.index!.count).toBe(36*3);
  expect(parts.getW(0)).toBe(128);expect(parts.getW(count)).toBe(136);expect(parts.getW(count+24)).toBe(144);
  expect(parts.getY(count)).toBe(-4);expect(parts.getY(count+24)).toBe(-5);expect(body.getAttribute('_parts').getW(0)).toBe(0);
  for(const name of ['position','normal','color'])for(let i=0;i<24;i++)for(let c=0;c<3;c++)expect(live.getAttribute(name).getComponent(count+i,c)).toBe(selected.getAttribute(name).getComponent(i,c));
  expect(Array.from(selected.getAttribute('_parts').array).filter((_,i)=>i%4===3).every(w=>w===0)).toBe(true);
  let retired=0;body.addEventListener('dispose',()=>retired++);live.dispose();expect(retired).toBe(1);accessories.dispose();
});
test('T-E07-12-headwear-pose @E07 live merged head vertices match the separately fitted head matrix',()=>{
  const {accessories,body,entity,batches,ids}=fixture(), pose=new Matrix4().makeRotationX(.2), transform=new Matrix4().makeRotationY(.6).setPosition(4,1,-3);
  const poses={clip:{parts:['head']},part:(_f:number,_o:number,_w:number,_h:number,out:Matrix4)=>out.copy(pose)} as unknown as CrowdPosePalette;
  accessories.begin();accessories.place(entity(),'lod2',poses,0,[0,1],transform);
  const old=new Matrix4();batches.get(`${ids[0]}:lod1`)!.getMatrixAt(0,old);
  const live=accessories.livingSource(body,'npc.civilian-man-a',0), offset=body.getAttribute('position').count, combined=new Matrix4().multiplyMatrices(transform,pose);
  for(let i=0;i<24;i++){
    const before=new Vector3().fromBufferAttribute(batches.get(`${ids[0]}:lod1`)!.geometry.getAttribute('position'),i).applyMatrix4(old);
    const after=new Vector3().fromBufferAttribute(live.getAttribute('position'),offset+i).applyMatrix4(combined);
    expect(after.distanceTo(before)).toBeLessThan(1e-6);
  }
  live.dispose();accessories.dispose();
});
test('T-E07-12-headwear-count @E07 actual shared accessory draws count infected users once and clear each frame',()=>{
  const {accessories,body,entity}=fixture(), poses={clip:{parts:['head']},part:(_f:number,_o:number,_w:number,_h:number,out:Matrix4)=>out.identity()} as unknown as CrowdPosePalette;
  accessories.begin();expect(accessories.infectedDrawCalls()).toBe(0);
  accessories.place(entity(),'lod2',poses,0,[0,1],new Matrix4());accessories.place(entity(78),'lod2',poses,0,[0,1],new Matrix4());expect(accessories.infectedDrawCalls()).toBe(1);
  accessories.begin();expect(accessories.infectedDrawCalls()).toBe(0);
  const civilian=entity();civilian.faction='civilian';accessories.place(civilian,'lod2',poses,0,[0,1],new Matrix4());expect(accessories.infectedDrawCalls()).toBe(0);
  accessories.dispose();body.dispose();
});
