import { expect, test, vi } from 'vitest';
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

test('@E18 static batch matrices retain district origin while roofs and placements change', () => {
 const f = fixture();
 try {
  const district = new Group(); district.position.set(100, 0, 50); district.add(f.hero);
  const freeze = (DistrictView.prototype as unknown as { freezeBatch(batch: InstancedGroup): void }).freezeBatch;
  freeze.call(district, f.hero);
  const roof = f.hero.getObjectByName('roof') as InstancedMesh;
  const worldMatrix = roof.matrixWorld.clone();
  expect(new Vector3().setFromMatrixPosition(worldMatrix).toArray()).toEqual([100, 0, 50]);
  const walk = vi.spyOn(roof, 'updateMatrixWorld');
  district.updateMatrixWorld(true);
  expect(walk).not.toHaveBeenCalled();
  expect(roof.matrixWorld.equals(worldMatrix)).toBe(true);
  f.hero.roofVisible(false, f.refs[0]);
  expect(f.scale(f.hero, 'roof', 0)).toEqual([0, 0, 0]);
  f.hero.roofVisible(true, f.refs[0]);
  f.refs[0].position.x = 3; f.hero.update([0]);
  const instance = new Matrix4(); roof.getMatrixAt(0, instance);
  expect(new Vector3().setFromMatrixPosition(instance).toArray()).toEqual([3, 0, 0]);
  expect(roof.matrixWorld.equals(worldMatrix)).toBe(true);
  f.near.references.length = 0; district.add(f.near); freeze.call(district, f.near);
  expect(f.near.visible).toBe(false);
 } finally { f.dispose(); }
});

test('@E18 cloned layout drops empty placement markers and retains drawn children', () => {
 const layout = new Group(), placement = new Object3D(), crown = new Object3D(), anchor = new Object3D();
 placement.userData.assetId = 'bld.courier-depot'; crown.userData.foliageColors = ['foliageDark', 'foliageLight'];
 const building = new Group(); building.userData.assetId = 'bld.courier-depot';
 const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.userData.assetId = 'prop.crates'; building.add(mesh);
 layout.add(placement, crown, anchor, building);
 const clone = layout.clone(true);
 const strip = (DistrictView.prototype as unknown as { stripLayoutMarkers(root: Object3D): void }).stripLayoutMarkers;
 try {
  strip.call({}, clone);
  expect(clone.children).toHaveLength(2); expect(clone.children[0].type).toBe('Object3D');
  expect(clone.children[1].children[0]).toBeInstanceOf(Mesh);
  expect(layout.children).toHaveLength(4); // Original metadata still feeds instancing and crowns.
  const district = new Group(); district.position.set(100, 0, 50); district.add(clone);
  const freeze = (DistrictView.prototype as unknown as { freezeLayout(root: Object3D): void }).freezeLayout;
  freeze.call({}, clone);
  const drawn = clone.children[1].children[0];
  const matrix = drawn.matrixWorld.clone(), walk = vi.spyOn(drawn, 'updateMatrixWorld');
  district.updateMatrixWorld(true);
  expect(walk).not.toHaveBeenCalled(); expect(drawn.matrixWorld.equals(matrix)).toBe(true);
  expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([100, 0, 50]);
 } finally { mesh.geometry.dispose(); (mesh.material as MeshBasicMaterial).dispose(); }
});


test('@E18 static doorway geometry is reused while opening and closing remain live', () => {
 const ref = new Object3D(), group = { pose: vi.fn() };
 const entry = { id: 'bld.clinic-annex', origin: [100, 50], refs: [ref], hero: group, near: group, far: group };
 const context = { frameSeconds: .4, lodBatches: [entry], doorOpen: new Map() };
 const update = (DistrictView.prototype as unknown as { updateDoors(bodies: Iterable<{x: number; z: number}>): void }).updateDoors;
 update.call(context, [{ x: 102.53, z: 49.82 }]);
 const state = context.doorOpen.get(ref), way = state.way;
 expect(state.k).toBe(1); expect(group.pose).toHaveBeenCalled();
 update.call(context, []);
 expect(state.k).toBe(0); expect(context.doorOpen.get(ref).way).toBe(way);
});
