/** Approved pilot-2 rollout. Always read pre-job game geometry; never infer a new face/body. */
import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getBounds,prune } from '@gltf-transform/functions';
import type { AssetDef } from '../../src/assets/types';
import { assetIO } from '../assets/io';
import { measureFigure,calibrateFigure,planHeadScale } from '../assets/figure-proportions';
import {prepareHeadProfile}from'./head-profiles';
import { skinCrowdBakes } from '../assets/skin-crowd-bakes';
const base='4698e5aa0',batch=process.argv[2]??'batch-1',ids=process.argv.slice(3);
if(!ids.length)throw Error('Pass an explicit reviewed batch of IDs');
const original=(path:string)=>execFileSync('git',['show',`${base}:${path}`],{maxBuffer:64*1024*1024});
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const io=await assetIO(),manifest=JSON.parse(readFileSync('src/assets/manifest.json','utf8')) as AssetDef[];
const oldManifest=JSON.parse(original('src/assets/manifest.json').toString()) as AssetDef[];
const heroinePath='public/assets/models/char.courier-female.skin.glb';
if(!readFileSync(heroinePath).equals(original(heroinePath)))throw Error('Heroine changed');
const target=measureFigure(await io.read(heroinePath)).ratios;
const bakes=JSON.parse(readFileSync('src/assets/civilianBakes.json','utf8')) as Record<string,string>;
const directory='docs/reports/q249/rollout';mkdirSync(directory,{recursive:true});
const previousPath=`${directory}/${batch}.json`;
const previous=existsSync(previousPath)?JSON.parse(readFileSync(previousPath,'utf8')).receipts:[];
const receipts=[];
for(const id of ids){
 if(id==='npc.civilian-man-a'||id==='char.courier-female')throw Error('Approved figures must not be recalibrated');
 const def=manifest.find(d=>d.id===id)!,old=oldManifest.find(d=>d.id===id)!;
 const inputs=[...new Set([old.sourceGlb!,old.glb,...Object.values(old.lods??{}),...[old.glb,...Object.values(old.lods??{})].map(p=>p.replace('.glb','.low.glb')).filter(existsSync),
  ...id==='char.courier-male'?['assets/char.courier-male-skin/model.skin.glb','public/assets/models/char.courier-male.skin.glb','public/assets/models/char.courier-male.skin.low.glb']:[]])];
 const prepared=[];
 try{
  for(const path of inputs){
   const bytes=original(path),doc=await io.readBinary(bytes);
   await prepareHeadProfile(doc,id);
   const roots=id==='npc.survivor-group'?doc.getRoot().listNodes().filter(n=>/^survivor\d+_root$/.test(n.getName())).map(n=>n.getName()):[undefined];
   const textures=doc.getRoot().listTextures().map(t=>sha(t.getImage()!));
   const figures=[];
   for(const rootName of roots){
    const before=measureFigure(doc,rootName),plan=planHeadScale(before,target);
    const prior=previous.find((p:{id:string})=>p.id===id)?.files?.find((p:{path:string})=>p.path===path);
    const priorFigure=prior?.figures?.find((p:{rootName?:string})=>p.rootName===rootName)??prior;
    let scale=['inf.crawler','inf.suburban-mom'].includes(id)?plan.scale:priorFigure?.headScale??plan.scale;
    if(['inf.crawler','inf.suburban-mom'].includes(id))for(let attempt=0;attempt<16;attempt++){
      const trial=await io.readBinary(bytes);await prepareHeadProfile(trial,id);const r=calibrateFigure(trial,target,{headScale:scale,rootName});
      const excess=Math.max(r.after.headHeight/(target.headHeight*1.098),r.after.headShoulder/(target.headShoulder*1.098));
      if(excess<=1)break;scale/=excess*1.005;
    }
    const receipt=calibrateFigure(doc,target,{headScale:scale,rootName});
    for(const key of ['headHeight','headShoulder'] as const)if(receipt.after[key]/target[key]>1.10001)throw Error(`${path}: ${key} exceeds heroine × 1.1`);
    figures.push({rootName,plan,...receipt});
   }
   if(JSON.stringify(textures)!==JSON.stringify(doc.getRoot().listTextures().map(t=>sha(t.getImage()!))))throw Error('Texture changed');
   await doc.transform(prune({keepLeaves:true,keepAttributes:true}));
   const output=await io.writeBinary(doc);
   prepared.push({path,output,document:doc,receipt:{path,sourceSha256:sha(bytes),outputSha256:sha(output),texturesUnchanged:true,figures}});
  }
  for(const p of prepared)writeFileSync(p.path,p.output);
  const high=prepared.find(p=>p.path===old.glb)!.document,b=getBounds(high.getRoot().listNodes().find(n=>n.getName()==='skin_body')??high.getRoot().listScenes()[0]);
  def.dimensions={...def.dimensions,x:b.max[0]-b.min[0],y:b.max[1]-b.min[1],z:b.max[2]-b.min[2]};
  if(def.crowdSkin)Object.assign(bakes,await skinCrowdBakes(def));
  receipts.push({id,status:'built',files:prepared.map(p=>p.receipt)});
  writeFileSync('src/assets/manifest.json',JSON.stringify(manifest,null,2)+'\n');writeFileSync('src/assets/civilianBakes.json',JSON.stringify(bakes,null,2)+'\n');
  console.log('BUILT',id,prepared.length,'files');
 }catch(error){receipts.push({id,status:'needs-direction',error:String(error)});console.log('HELD',id,String(error));}
 writeFileSync(`${directory}/${batch}.json`,JSON.stringify({baseline:base,target,receipts},null,2)+'\n');
}
