import { expect, test } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, Vector3 } from 'three/webgpu';
import { InstancedGroup } from '../../../src/render/InstancedGroup';
import { DistrictView } from '../../../src/render/DistrictView';

function fixture() {
 const prototype=new Group(), geometry=new BoxGeometry(), material=new MeshBasicMaterial();
 for(const name of ['roof','roof-light','static-body']){const mesh=new Mesh(geometry,material);mesh.name=name;prototype.add(mesh);}
 const refs=[new Object3D(),new Object3D()];refs[1].position.x=20;
 const hero=new InstancedGroup(prototype,refs.slice()),near=new InstancedGroup(prototype,refs.slice()),far=new InstancedGroup(prototype,refs.slice());
 const dispose=()=>{for(const group of [hero,near,far])group.dispose();geometry.dispose();material.dispose();};
 const scale=(group:InstancedGroup,name:string,index:number)=>{const matrix=new Matrix4();(group.getObjectByName(name) as InstancedMesh).getMatrixAt(index,matrix);return new Vector3().setFromMatrixScale(matrix).toArray();};
 return {refs,hero,near,far,dispose,scale};
}

test('@E21 roofs hide only the occupied instance, restore on exit and survive LOD repartition',()=>{
 const f=fixture();try {
  for(const group of [f.hero,f.near,f.far])group.roofVisible(false,f.refs[0]);
  for(const group of [f.hero,f.near,f.far]){
   expect(f.scale(group,'roof',0)).toEqual([0,0,0]);expect(f.scale(group,'roof-light',0)).toEqual([0,0,0]);
   expect(f.scale(group,'roof',1)).toEqual([1,1,1]);expect(f.scale(group,'static-body',0)).toEqual([1,1,1]);
  }
  f.far.references.reverse();f.far.update();
  expect(f.scale(f.far,'roof',0)).toEqual([1,1,1]);expect(f.scale(f.far,'roof',1)).toEqual([0,0,0]);
  for(const group of [f.hero,f.near,f.far])group.roofVisible(true,f.refs[0]);
  expect(f.scale(f.far,'roof',1)).toEqual([1,1,1]);
 }finally{f.dispose();}
});

test('@E21 rotated rectangular footprints use courier position, scale and district origin for cutaways',()=>{
 const f=fixture();try{
  f.refs[0].rotation.y=Math.PI/2;f.refs[0].scale.set(2,1,1);
  // Depot: 4.55 x 5.266; rotation sends its long local X side along world Z.
  const context={roofPoint:new Vector3(),lodBatches:[{id:'bld.courier-depot',refs:f.refs,origin:[100,50],hero:f.hero,near:f.near,far:f.far}]};
  const update=(DistrictView.prototype as unknown as {updateRoofs(player:{x:number;y:number;z:number}):void}).updateRoofs.bind(context);
  update({x:100,y:0,z:54});expect(f.refs[0].userData.roofHidden).toBe(true);expect(f.refs[1].userData.roofHidden).toBeUndefined();
  update({x:106,y:0,z:50});expect(f.refs[0].userData.roofHidden).toBe(false);
  update({x:100,y:20,z:50});expect(f.refs[0].userData.roofHidden).toBe(false);
 }finally{f.dispose();}
});
