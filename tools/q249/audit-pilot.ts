/** Read-only receipt for the one-ped PO gate; rejects any extra figure rollout. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Document } from '@gltf-transform/core';
import { assetIO } from '../assets/io';
const baseline='4698e5aa0', id='npc.civilian-man-a';
const original=(path:string)=>execFileSync('git',['show',`${baseline}:${path}`],{maxBuffer:64*1024*1024});
const io=await assetIO();
const ratios=JSON.parse(readFileSync('docs/reports/q249/pilot-2/ratios.json','utf8'));
const stats=(document:Document)=>document.getRoot().listMeshes().map(mesh=>({name:mesh.getName(),primitives:mesh.listPrimitives().map(p=>({indices:p.getIndices()?.getCount(),attributes:Object.fromEntries(p.listSemantics().sort().map(name=>[name,p.getAttribute(name)!.getCount()]))}))}));
const geometry=[];
for(const row of ratios.rows){
 const before=stats(await io.readBinary(original(row.input))),after=stats(await io.read(row.output));
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error(`Topology/attribute change: ${row.output}`);
 geometry.push({path:row.output,triangles:before.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+(p.indices??p.attributes.POSITION)/3,0),0),topologyAndAttributeCountsUnchanged:true});
}
const changed=(path:string)=>{
 const old=JSON.parse(original(path).toString()),now=JSON.parse(readFileSync(path,'utf8'));
 if(Array.isArray(old))return old.filter((v,i)=>JSON.stringify(v)!==JSON.stringify(now[i])).map(v=>v.id);
 return [...new Set([...Object.keys(old),...Object.keys(now)])].filter(k=>old[k]!==now[k]);
};
const manifestChanges=changed('src/assets/manifest.json'),bakeChanges=changed('src/assets/civilianBakes.json');
if(manifestChanges.some(x=>x!==id)||bakeChanges.some(x=>!x.startsWith(id+':')))throw Error('A second figure was changed');
const trackedFigureChanges=execFileSync('git',['diff',baseline,'--name-only','--','assets','public/assets'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
if(trackedFigureChanges.some(x=>!x.startsWith('assets/'+id+'/model.q249.')&&!x.startsWith('public/assets/models/q249-pilot/')&&!x.startsWith('public/assets/civilians/'+id+'.lod')))throw Error('An original figure asset was changed');
const report={baseline,manifestChanges,bakeChanges,geometry,trackedFigureChanges,approvedHeroineUnchanged:readFileSync('public/assets/models/char.courier-female.skin.glb').equals(original('public/assets/models/char.courier-female.skin.glb')),maximumUnchangedBodyDeltaM:Math.max(...ratios.rows.map((r:{unchangedBodyMaxDisplacementM:number})=>r.unchangedBodyMaxDisplacementM))};
if(!report.approvedHeroineUnchanged)throw Error('Heroine changed');
writeFileSync('docs/reports/q249/pilot-2/audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
