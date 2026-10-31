import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {assetIO} from '../assets/io';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
const io=await assetIO(),slim='146de330b',main='b0aac03dd99be27e63c9737edc7de0c4759e7ea1';
const old=(revision:string,path:string)=>io.readBinary(execFileSync('git',['show',`${revision}:${path}`],{maxBuffer:32*1024*1024}));
const originalBytes=(revision:string,path:string)=>execFileSync('git',['show',`${revision}:${path}`],{maxBuffer:32*1024*1024});
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const array=(a:import('@gltf-transform/core').Accessor)=>{const v=a.getArray()!;return sha(new Uint8Array(v.buffer,v.byteOffset,v.byteLength));};
const preservedScripts=['tools/assets/courier-male-shirt-clean.py','assets/acc.courier-gear/build.py','tools/assets/courier-tex-compress.ts','tools/assets/courier-gear-compress.ts'].map(path=>{const digest=sha(readFileSync(path));assert.equal(digest,sha(originalBytes(main,path)));return{path,sha256:digest,exactToMain:true};});
const femaleGear=['.glb','.low.glb','.lod2.glb'].map(suffix=>{const path=`public/assets/models/acc.courier-gear.female.tiers${suffix}`;assert.equal(sha(readFileSync(path)),sha(originalBytes(main,path)));return{path,exactToMain:true};});
const excluded=new Set(['assets/char.courier-male-skin/model.skin.glb','public/assets/models/char.courier-male.skin.glb','public/assets/models/char.courier-male.skin.low.glb']);
const build=JSON.parse(readFileSync('docs/reports/slim/rollout/build.json','utf8')) as {receipts:{files:{output:string}[]}[]};
const remainingSlimExports=[...new Set(build.receipts.flatMap(r=>r.files.map(f=>f.output)))].filter(path=>!excluded.has(path));
for(const path of remainingSlimExports)assert.equal(sha(readFileSync(path)),sha(originalBytes(slim,path)),`${path}: approved slim export lost`);
const source='assets/char.courier-male-skin/model.skin.glb',before=await old(slim,source),after=await io.read(source);
const beforeHem=await old('932e60f1f^',source);
assert.deepEqual(before.getRoot().listTextures().map(t=>sha(t.getImage()!)),beforeHem.getRoot().listTextures().map(t=>sha(t.getImage()!)));
assert.deepEqual(after.getRoot().listNodes().map(n=>[n.getName(),n.getMatrix()]),before.getRoot().listNodes().map(n=>[n.getName(),n.getMatrix()]));
assert.deepEqual(after.getRoot().listAccessors().map(array),before.getRoot().listAccessors().map(array));
assert.notDeepEqual(after.getRoot().listTextures().map(t=>sha(t.getImage()!)),before.getRoot().listTextures().map(t=>sha(t.getImage()!)));
const rows=[];
const primitive=(d:typeof before)=>d.getRoot().listNodes().find(n=>n.getSkin()&&n.getMesh())!.getMesh()!.listPrimitives()[0];
const surface=(p:ReturnType<typeof primitive>)=>{const pos=p.getAttribute('POSITION')!,ix=p.getIndices()!;const g=new BufferGeometry().setAttribute('position',new BufferAttribute(Float32Array.from({length:pos.getCount()*3},(_,i)=>pos.getElement(Math.floor(i/3),[])[i%3]),3)).setIndex(new BufferAttribute(Uint32Array.from({length:ix.getCount()},(_,i)=>ix.getScalar(i)),1));return new MeshBVH(g,{indirect:true});};
for(const file of ['char.courier-male.skin.glb','char.courier-male.skin.low.glb','acc.courier-gear.male.tiers.glb','acc.courier-gear.male.tiers.low.glb','acc.courier-gear.male.tiers.lod2.glb']) {
 const path='public/assets/models/'+file,doc=await io.read(path),original=await old(slim,path),theirs=await old(main,path);
 for(const a of doc.getRoot().listAccessors())for(const x of a.getArray()!)assert.ok(Number.isFinite(x),`${file}: finite ${a.getName()}`);
 const nodes=doc.getRoot().listNodes().filter(n=>n.getSkin()&&n.getMesh());assert.equal(nodes.length,1);
 const node=nodes[0],p=node.getMesh()!.listPrimitives()[0],pos=p.getAttribute('POSITION')!;
 assert.deepEqual(node.getSkin()!.listJoints().map(n=>n.getName()),original.getRoot().listSkins()[0].listJoints().map(n=>n.getName()));
 const textures=doc.getRoot().listTextures().map(t=>sha(t.getImage()!));
 let slimBodySurfaceDeltaM:number|undefined,innerContactMaxM:number|undefined;
 if(file.startsWith('char.')){
  const reference=surface(primitive(original));slimBodySurfaceDeltaM=0;
  for(let i=0;i<pos.getCount();i++)slimBodySurfaceDeltaM=Math.max(slimBodySurfaceDeltaM,reference.closestPointToPoint(new Vector3().fromArray(pos.getElement(i,[])))!.distance);
  assert.ok(slimBodySurfaceDeltaM<1e-6,`${file}: slim body surface changed`);
 }else{
  const reference=surface(primitive(await io.read('public/assets/models/char.courier-male.skin.glb'))),inner=p.getAttribute('_INNER')!;assert.ok(inner);innerContactMaxM=0;
  for(let i=0;i<pos.getCount();i++)if(inner.getScalar(i)>.5)innerContactMaxM=Math.max(innerContactMaxM,reference.closestPointToPoint(new Vector3().fromArray(pos.getElement(i,[])))!.distance);
  assert.ok(innerContactMaxM<=.02,`${file}: inner contact exceeds unchanged 2 cm limit`);
 }
 rows.push({path,vertices:pos.getCount(),triangles:p.getIndices()!.getCount()/3,tierTris:node.getExtras().tierTris??null,slimBodySurfaceDeltaM,innerContactMaxM,textures,slimTextures:original.getRoot().listTextures().map(t=>sha(t.getImage()!)),mainTextures:theirs.getRoot().listTextures().map(t=>sha(t.getImage()!)),finite:true,rigJointNamesUnchanged:true});
}
writeFileSync('docs/reports/slim/merge/asset-audit.json',JSON.stringify({slim,main,preservedScripts,femaleGear,otherApprovedSlimExportsExact:remainingSlimExports.length,initialShirtRepairAlreadyPresent:true,sourceGeometryAllAccessorsAndNodeMatricesExact:true,sourceTextureRepainted:true,pass:true,rows},null,2)+'\n');
console.log('PASS: slim source geometry exact; repaired skin/gear high, low, LOD2 finite with original joint names.');
