// Run: npx tsx assets/char.survivor-female/scalp-regression.ts
// Cast exterior rays against runtime triangles with backface culling, so an
// inward cap or simplification exposing skin fails even if nodes still validate.
import assert from 'node:assert/strict';
import {assetIO} from '../../tools/assets/io';
import {Matrix4,Vector3,Ray} from 'three';
const io=await assetIO();
for(const id of ['char.survivor-female','char.survivor-male','npc.civilian-man-a','npc.civilian-man-b','npc.civilian-woman-a','npc.civilian-woman-b','npc.civilian-elderly','inf.common-worker','inf.crawler','inf.jogger','inf.cashier','inf.bbq-dad','inf.suburban-mom','inf.delivery-driver','inf.bathrobe-neighbor']) {
 for(const lod of ['',' .lod1',' .lod2'].map(s=>s.trim())) {
 const doc=await io.read(`public/assets/models/${id}${lod}.glb`);const triangles:{v:Vector3[],name:string}[]=[];
 for(const node of doc.getRoot().listNodes()) {let p:any=node;let head=false;while(p){if(p.getName()==='head')head=true;p=p.getParentNode();}if(!head)continue;
 const matrix=new Matrix4().fromArray(node.getWorldMatrix());
 for(const prim of node.getMesh()?.listPrimitives()??[]) {const pos=prim.getAttribute('POSITION')!;const inds=prim.getIndices();const vs=Array.from({length:pos.getCount()},(_,i)=>{const a=[0,0,0];pos.getElement(i,a);return new Vector3().fromArray(a).applyMatrix4(matrix);});for(let i=0;i<(inds?.getCount()??vs.length);i+=3)triangles.push({v:[0,1,2].map(j=>vs[inds?.getScalar(i+j)??i+j]),name:prim.getMaterial()?.getName()??''});}
 }
 const skin=triangles.filter(t=>/skin/i.test(t.name));assert.ok(skin.length, `${id}${lod}: head skin geometry missing`);
 const points=skin.flatMap(t=>t.v);const maxY=Math.max(...points.map(v=>v.y));const crown=points.filter(v=>v.y>maxY-.025);const cx=crown.reduce((s,v)=>s+v.x,0)/crown.length,cz=crown.reduce((s,v)=>s+v.z,0)/crown.length;
 let exposed=0,total=0;const names=new Set<string>();
 for(const dx of [-.05,0,.05])for(const dz of [-.05,0,.05]) {const origin=new Vector3(cx+dx,maxY+1,cz+dz);const ray=new Ray(origin,new Vector3(0,-1,0));let dist=Infinity,name='';for(const t of triangles){const hit=ray.intersectTriangle(t.v[0],t.v[1],t.v[2],true,new Vector3());if(hit&&hit.distanceTo(origin)<dist){dist=hit.distanceTo(origin);name=t.name;}}if(name){total++;names.add(name);if(/skin/i.test(name))exposed++;}}
 assert.equal(total,9,`${id}${lod}: crown ray missed head`);
 assert.equal(exposed,0,`${id}${lod}: exposed crown (${Array.from(names)})`);
 console.log(`${id}${lod}: crown covered`);
 }
}
