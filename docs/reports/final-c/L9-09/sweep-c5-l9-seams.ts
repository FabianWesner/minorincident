import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {BufferAttribute,BufferGeometry,Matrix4,Mesh,MeshBasicMaterial,Vector3} from 'three/webgpu';
import {GroundField} from '../../../src/render/GroundField';
import {layoutTerrainChunks,type TerrainChunk} from '../../../src/sim/world/TerrainChunks';
import type {DistrictLayout} from '../../../src/levels/districts/types';
import {provenance} from './probe';
import {atomicJson} from './report';
const identity=provenance(),sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex'),layoutPath='public/assets/layouts/D-CROSSING.layout.json',layoutBytes=readFileSync(layoutPath),layout=JSON.parse(layoutBytes.toString()) as DistrictLayout,chunks=layoutTerrainChunks(layout);
await MeshoptDecoder.ready;const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}),material=new MeshBasicMaterial();
type Surface={ground:GroundField;triangles:number[][];file:string;sha256:string};
async function surface(file:string,origin:readonly number[]):Promise<Surface>{
 const bytes=readFileSync(file),doc=await io.readBinary(bytes),ground=new GroundField(),triangles:number[][]=[];
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
  const position=primitive.getAttribute('POSITION')!,vertices=new Float32Array(position.getCount()*3),v:number[]=[];
  for(let i=0;i<position.getCount();i++){position.getElement(i,v);vertices.set(v,i*3);}
  const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(vertices,3)),indices=primitive.getIndices();if(indices)geometry.setIndex(Array.from(indices.getArray()!));
  const mesh=new Mesh(geometry,material);mesh.matrixWorld.fromArray(node.getWorldMatrix()).premultiply(new Matrix4().makeTranslation(origin[0],0,origin[1]));ground.add(mesh);
  const p=[new Vector3(),new Vector3(),new Vector3()],count=geometry.index?.count??position.getCount();for(let i=0;i<count;i+=3){for(let j=0;j<3;j++)p[j].fromBufferAttribute(geometry.getAttribute('position'),geometry.index?.getX(i+j)??i+j).applyMatrix4(mesh.matrixWorld);if(Math.max(...p.map(v=>v.y))<=.4&&Math.abs((p[1].z-p[0].z)*(p[2].x-p[0].x)-(p[1].x-p[0].x)*(p[2].z-p[0].z))>=1e-8)triangles.push(p.flatMap(v=>[v.x,v.y,v.z]));}
  geometry.dispose();
 }
 return{ground,triangles,file,sha256:sha(bytes)};
}
const cells=new Map<string,Surface>();for(const c of chunks)cells.set(c.id,await surface(`public/assets/layouts/D-CROSSING.chunks/${c.id}.glb`,c.origin));
const horizon=await surface('public/assets/layouts/D-CROSSING.horizon.glb',[0,0]),rows=[];
function adjacent(a:TerrainChunk,b:TerrainChunk){if(a.max[0]===b.origin[0]&&a.origin[1]===b.origin[1])return{axis:0,fixed:a.max[0],lo:a.origin[1],hi:a.max[1]};if(a.max[1]===b.origin[1]&&a.origin[0]===b.origin[0])return{axis:2,fixed:a.max[1],lo:a.origin[0],hi:a.max[0]};return null;}
for(const a of chunks)for(const b of chunks){
 const seam=adjacent(a,b);if(!seam)continue;const aa=cells.get(a.id)!,bb=cells.get(b.id)!,breaks=[seam.lo,seam.hi];
 const lines:{lo:number;hi:number;m:number;b:number}[]=[];
 for(const t of [...aa.triangles,...bb.triangles,...horizon.triangles]){
  const hits:{at:number;y:number}[]=[];
  for(let i=0;i<3;i++){const j=(i+1)%3,axis=seam.axis,other=axis===0?2:0,da=t[i*3+axis]-seam.fixed,db=t[j*3+axis]-seam.fixed;
   if(da===0)hits.push({at:t[i*3+other],y:t[i*3+1]});if(da*db<0){const k=da/(da-db);hits.push({at:t[i*3+other]+(t[j*3+other]-t[i*3+other])*k,y:t[i*3+1]+(t[j*3+1]-t[i*3+1])*k});}
  }
  hits.sort((a,b)=>a.at-b.at);const first=hits[0],last=hits.at(-1);if(!first||!last||last.at<=first.at||last.at<seam.lo||first.at>seam.hi)continue;
  const m=(last.y-first.y)/(last.at-first.at),lo=Math.max(seam.lo,first.at),hi=Math.min(seam.hi,last.at);lines.push({lo,hi,m,b:first.y-m*first.at});breaks.push(lo,hi);
 }
 for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const a=lines[i],b=lines[j];if(Math.abs(a.m-b.m)<1e-12)continue;const at=(b.b-a.b)/(a.m-b.m);if(at>Math.max(a.lo,b.lo)&&at<Math.min(a.hi,b.hi))breaks.push(at);}
 const sorted=[...new Set(breaks.filter(v=>v>=seam.lo&&v<=seam.hi))].sort((a,b)=>a-b),samples=[...sorted,...sorted.slice(1).flatMap((v,i)=>[(v+sorted[i])/2,Math.min(v,sorted[i]+1e-5),Math.max(sorted[i],v-1e-5)])];
 let maxMismatch=0,maxHorizonMismatch=0,missing=0,horizonMissing=0;const worst=[];
 for(const t of samples){const x=seam.axis===0?seam.fixed:t,z=seam.axis===2?seam.fixed:t,ha=aa.ground.height(x,z),hb=bb.ground.height(x,z),hh=horizon.ground.height(x,z);if(ha===null||hb===null){missing++;worst.push({x,z,ha,hb,hh});continue;}if(hh===null)horizonMissing++;const d=Math.abs(ha-hb),h=hh===null?0:Math.max(Math.abs(ha-hh),Math.abs(hb-hh));maxMismatch=Math.max(maxMismatch,d);maxHorizonMismatch=Math.max(maxHorizonMismatch,h);if(d>.02||h>.02)worst.push({x,z,ha,hb,hh});}
 rows.push({a:a.id,b:b.id,...seam,samples:samples.length,maxMismatch,maxHorizonMismatch,missing,horizonMissing,worst});
}
assert.equal(cells.size,96,'All actual terrain cells');
atomicJson('docs/reports/final-c/L9-09/seams.json',{...identity,toolSha256:sha(readFileSync(new URL(import.meta.url))),method:'Read actual96runtimeGLBs with exact cell/node transforms and production GroundField height evaluator. Each sharedboundary partitioned at every triangle-edge intersection, including both vertices/midpoints/epsilon-side samples and every affine segment intersection (upper-envelope switch), including nonflat bevel triangles. These partitions cover piecewise-affine height steps. Compare each neighboring detail pair. Auxiliary horizon heights include always-present structural/curb triangles and missing road paint, and are not treated as neighboring-cell seam defects; no generated replacement geometry. Bothqualities use samegeometry.',layout:{file:layoutPath,sha256:sha(layoutBytes)},assets:[...cells.values(),horizon].map(({file,sha256})=>({file,sha256})),piecewiseAffine:true,rows,summary:{pairs:rows.length,samples:rows.reduce((n,r)=>n+r.samples,0),maxMismatch:Math.max(...rows.map(r=>r.maxMismatch)),maxHorizonMismatch:Math.max(...rows.map(r=>r.maxHorizonMismatch)),missing:rows.reduce((n,r)=>n+r.missing,0)}});
material.dispose();console.log(rows.length,Math.max(...rows.map(r=>r.maxMismatch)),Math.max(...rows.map(r=>r.maxHorizonMismatch)),rows.reduce((n,r)=>n+r.missing,0));
