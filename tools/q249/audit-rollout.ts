import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import type {Document} from '@gltf-transform/core';
import {assetIO} from '../assets/io';
import{prepareHeadProfile}from'./head-profiles';
import {measureFigure} from '../assets/figure-proportions';
const io=await assetIO(),baseline='4698e5aa0',original=(p:string)=>execFileSync('git',['show',`${baseline}:${p}`],{maxBuffer:64*1024*1024}),sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const output=process.argv[2]??'docs/reports/q249/rollout/export-audit.json';
const census=JSON.parse(readFileSync('docs/reports/q249/rollout/census.json','utf8')) as {rows:{id:string;rootName?:string;child?:boolean;path:string}[]};
const target=measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).ratios;
const batches=[1,2,3,4,5].map(n=>JSON.parse(readFileSync(`docs/reports/q249/rollout/batch-${n}.json`,'utf8')));
const files=new Map<string,{id:string;path:string;beforePath?:string;record:Record<string,unknown>}>();
for(const batch of batches)for(const entry of batch.receipts){if(entry.status!=='built')throw Error(`${entry.id} not built`);for(const f of entry.files)files.set(f.path,{id:entry.id,path:f.path,record:f});}
const oldDefs=JSON.parse(original('src/assets/manifest.json').toString()) as {id:string;glb:string;sourceGlb:string;lods:Record<string,string>}[];
const newDefs=JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as typeof oldDefs;
const oldPilot=oldDefs.find(d=>d.id==='npc.civilian-man-a')!,newPilot=newDefs.find(d=>d.id==='npc.civilian-man-a')!;
const paths=(d:typeof oldPilot)=>[d.sourceGlb,d.glb,...Object.values(d.lods),...[d.glb,...Object.values(d.lods)].map(p=>p.replace('.glb','.low.glb'))];
const pilotBefore=paths(oldPilot),pilotAfter=paths(newPilot);
for(let i=0;i<pilotAfter.length;i++)files.set(pilotAfter[i],{id:newPilot.id,path:pilotAfter[i],beforePath:pilotBefore[i],record:{approvedPilot2:true}});
const errors:string[]=[],rows=[];
const triangleCount=(d:Document)=>d.getRoot().listNodes().filter(n=>n.getMesh()&&!n.getExtras().hidden&&!/stump/.test(n.getName())).reduce((sum,n)=>sum+n.getMesh()!.listPrimitives().reduce((a,p)=>a+(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3,0),0);
for(const {id,path,beforePath=path,record}of files.values()){
 const before=await io.readBinary(original(beforePath)),after=await io.read(path);await prepareHeadProfile(before,id);
 const hashImages=(d:Document)=>d.getRoot().listTextures().map(t=>sha(t.getImage()!));
 const oldImages=hashImages(before),images=hashImages(after);
 if(images.some(h=>!oldImages.includes(h)))errors.push(`${path}: image bytes changed`);
 const roots=id==='npc.survivor-group'?after.getRoot().listNodes().filter(n=>/^survivor\d+_root$/.test(n.getName())).map(n=>n.getName()):[undefined];
 const figures=roots.map(rootName=>{const b=measureFigure(before,rootName),a=measureFigure(after,rootName,b.height);for(const k of ['headHeight','headShoulder']as const)if(a.ratios[k]>target[k]*1.1+1e-5)errors.push(`${path} ${rootName??''} ${k}: ${a.ratios[k]}`);if(Math.abs(a.shoulderWidth-b.shoulderWidth)>1e-5)errors.push(`${path}: shoulder envelope changed`);return {rootName,before:b.ratios,after:a.ratios,shoulderBefore:b.shoulderWidth,shoulderAfter:a.shoulderWidth};});
 const beforeTriangles=triangleCount(before),triangles=triangleCount(after);if(triangles>beforeTriangles)errors.push(`${path}: geometry grew`);
 rows.push({id,path,sha256:sha(readFileSync(path)),bytesBefore:original(beforePath).length,bytesAfter:readFileSync(path).length,texturesUnchanged:true,trianglesBefore:beforeTriangles,triangles,figures,source:record});
}
const completed=new Set(batches.flatMap(b=>b.receipts.map((r:{id:string})=>r.id)));completed.add('npc.civilian-man-a');
for(const row of census.rows)if(!row.child&&!completed.has(row.id))errors.push(`Missing variant ${row.id}`);
if(!readFileSync('public/assets/models/char.courier-female.skin.glb').equals(original('public/assets/models/char.courier-female.skin.glb')))errors.push('Heroine changed');
for(const id of ['npc.civilian-kid','npc.brother'])for(const path of [census.rows.find(r=>r.id===id)!.path])if(!readFileSync(path).equals(original(path)))errors.push(`${id}: child anatomy changed`);
const report={baseline,target,policy:'Head-size upper limits win; uniform head shrink; body fixed; lower head ratios permitted by PO',variants:completed.size,figures:census.rows.filter(r=>!r.child).length,files:rows.length,errors,rows};
writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(`${report.variants} adult variants / ${report.figures} figures / ${rows.length} files / ${errors.length} errors (${output})`);if(errors.length){console.log(errors.join('\n'));process.exitCode=1;}
