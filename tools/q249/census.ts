/** Read-only anatomy census of every delivered adult human and child exception. */
import { writeFileSync,mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { AssetDef } from '../../src/assets/types';
import{prepareHeadProfile}from'./head-profiles';
import { assetIO } from '../assets/io';
import { measureFigure,planHeadScale } from '../assets/figure-proportions';
const io=await assetIO(),baseline='4698e5aa0';
const original=(path:string)=>execFileSync('git',['show',`${baseline}:${path}`],{maxBuffer:64*1024*1024});
const manifest=JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const target=measureFigure(await io.read('public/assets/models/char.courier-female.skin.glb')).ratios;
const animals=/corgi|dog|cat|crow|lion|gorilla|flamingo|zebra|elephant/;
const rows=[];
for(const def of manifest.filter(d=>['character','infected'].includes(d.category)&&!animals.test(d.id)&&d.id!=='char.courier-female')){
 const doc=await io.readBinary(original(def.glb));await prepareHeadProfile(doc,def.id);
 const roots=def.id==='npc.survivor-group'?doc.getRoot().listNodes().filter(n=>/^survivor\d+_root$/.test(n.getName())).map(n=>n.getName()):[undefined];
 for(const rootName of roots){
  try {
   const before=measureFigure(doc,rootName),plan=planHeadScale(before,target);
   const child=['npc.civilian-kid','npc.brother'].includes(def.id);
   rows.push({id:def.id,rootName,path:def.glb,dimensions:def.dimensions,crowdSkin:!!def.crowdSkin,child,approvedPilot:def.id==='npc.civilian-man-a',before:before.ratios,plan:child?{binding:'child-proportions-retained',scale:1}:plan});
   console.log(def.id,rootName??'',child?'child':plan.binding,plan.scale.toFixed(3));
  }catch(e){rows.push({id:def.id,rootName,path:def.glb,error:String(e)});console.log(def.id,String(e));}
 }
}
mkdirSync('docs/reports/q249/rollout',{recursive:true});
writeFileSync('docs/reports/q249/rollout/census.json',JSON.stringify({baseline,target,policy:'PO: head size wins; both head ratios <= heroine x 1.1; smaller heads allowed; bodies fixed; children retain child proportions',rows},null,2)+'\n');
