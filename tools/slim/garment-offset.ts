/** Garment-to-body displacement offset, using the original clothed-body surface as the reference cage. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { assetIO } from '../assets/io';
import { surfacesOf } from './anatomy';
import { slimBuild, type Scales } from './deform';
const THRESHOLD_M = .010;
const io = await assetIO(), baseline = '53949e814';
const git = (revision:string,path:string) => execFileSync('git',['show',`${revision}:${path}`],{maxBuffer:64*1024*1024});
const build = JSON.parse(readFileSync('docs/reports/slim/rollout/build.json','utf8')) as {receipts:{id:string;files:{input:string;output:string;figures:{rootName?:string;scales:Scales}[]}[]}[]};
const reverted = new Set(process.env.SLIM_CHECK_REV ? [] : JSON.parse(readFileSync('docs/reports/slim/garments/reverted.json','utf8')) as string[]);
const rows=[];
for(const r of build.receipts.filter(r=>!process.env.SLIM_CHECK_IDS||process.env.SLIM_CHECK_IDS.split(',').includes(r.id))) {
  const files=[];let worst=0,corresponding=0,samples=0;
  for(const f of r.files) {
    const original=git(baseline,f.input),before=await io.readBinary(original),reference=await io.readBinary(original);
    if(!reverted.has(r.id)) for(const figure of f.figures) slimBuild(reference,figure.scales,figure.rootName);
    const actual=process.env.SLIM_CHECK_REV?await io.readBinary(git(process.env.SLIM_CHECK_REV,f.output)):await io.read(f.output);
    let maximum=0,maximumCorresponding=0,count=0;
    for(const figure of f.figures) {
      const b=surfacesOf(before,figure.rootName),ref=surfacesOf(reference,figure.rootName),now=surfacesOf(actual,figure.rootName),points:number[]=[],garments:{point:Vector3;expected:Vector3}[]=[];
      for(let si=0;si<b.length;si++) {
        const s=b[si],rv=new Map(ref[si].vertices.map(v=>[v.id,v])),av=new Map(now[si].vertices.map(v=>[v.id,v])),index=s.primitive.getIndices(),n=index?.getCount()??s.primitive.getAttribute('POSITION')!.getCount(),region=s.primitive.getAttribute('_CROWD_REGION');
        for(let t=0;t<n;t+=3) {
          const triangle=[0,1,2].map(k=>rv.get(index?index.getScalar(t+k):t+k)!.point);
          if(triangle.every(p=>p.toArray().every(Number.isFinite))) for(const p of triangle) points.push(...p.toArray());
        }
        for(const v of s.vertices) {
          if(/head|neck|eye|iris|pony|hair|hand|weapon/.test(v.jointOwner??v.owner)||region?.getScalar(v.id)===1||/skin|eye|blood/i.test(s.primitive.getMaterial()?.getName()??''))continue;
          const expected=rv.get(v.id)!.point,point=av.get(v.id)!.point;
          if(!v.point.toArray().every(Number.isFinite))continue;
          if(!expected.toArray().every(Number.isFinite)||!point.toArray().every(Number.isFinite))throw Error(`${f.output}: nonfinite garment vertex`);
          garments.push({point,expected});
        }
      }
      if(!points.length)throw Error(`${r.id}: no body reference surface`);
      const geometry=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(points),3)),tree=new MeshBVH(geometry),hit={point:new Vector3(),distance:0,faceIndex:0};
      for(const v of garments) {
        const closest=tree.closestPointToPoint(v.point,hit);if(!closest)throw Error('Missing body surface');
        maximum=Math.max(maximum,closest.distance);maximumCorresponding=Math.max(maximumCorresponding,v.point.distanceTo(v.expected));count++;
      }
      geometry.dispose();
    }
    worst=Math.max(worst,maximum);corresponding=Math.max(corresponding,maximumCorresponding);samples+=count;
    files.push({path:f.output,samples:count,maxSurfaceOffsetM:maximum,maxBodyDisplacementOffsetM:maximumCorresponding});
  }
  const pass=worst<=THRESHOLD_M&&corresponding<=THRESHOLD_M;
  rows.push({id:r.id,policy:reverted.has(r.id)?'reverted':'slimmed',pass,samples,maxSurfaceOffsetM:worst,maxBodyDisplacementOffsetM:corresponding,files});
  console.log(pass?'OK':'FLAG',r.id,(worst*1000).toFixed(3),(corresponding*1000).toFixed(3),samples);
}
mkdirSync('docs/reports/slim/garments',{recursive:true});
writeFileSync(process.env.SLIM_OFFSET_OUT??'docs/reports/slim/garments/offset-check.json',JSON.stringify({baseline,actualRevision:process.env.SLIM_CHECK_REV??'working tree',thresholdM:THRESHOLD_M,method:'Surface distance and corresponding-point displacement of outer garment vertices to the coherently body-deformed reference cage. These assets have one clothed mesh, not a separate hidden nude torso: the pre-slim clothed body is the reference surface. The reference uses authored bone influences throughout; no spatial arm reclassification. Skin/head/hand/weapon/cap vertices are excluded. Both offsets must be <=10 mm. Visual crops remain required: this check alone cannot prove bag shape or cloth fold quality.',pass:rows.every(r=>r.pass),rows},null,2)+'\n');
if(!process.env.SLIM_CHECK_REV&&!rows.every(r=>r.pass))process.exitCode=1;
