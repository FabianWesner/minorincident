/** Audit every L5 delivery against its exact continuous source, skin and byte/triangle budgets. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assetIO } from '../assets/io';
import { validateDocument } from '../assets/validate';
import type { AssetDef } from '../../src/assets/types';
const out='docs/reports/l5-all-new',json=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const ids=json(`${out}/census.json`).scope as string[], manifest=json('src/assets/manifest.json') as AssetDef[];
const io=await assetIO(), builds=[];
for(const id of ids){
 const dir=`${out}/builds/${id}`,build=json(`${dir}/build.json`),contract=json(join(build.source,'source/manifest.json')),def=manifest.find(a=>a.id===id)!;
 assert.ok(def.crowdSkin&&def.textureMode==='baseColor');assert.deepEqual(build.manualSteps,[]);
 const eyes=join(build.source,'eyes.json'), viewer=json(join(build.source,'pipeline-view.json'));const lods=[];
 assert.equal(viewer.source_sha256,sha(`assets/${id}/model.skin.glb`),'Pipeline viewer renders the current published body');
 for(const lod of [0,1,2]){
  const fit=json(`${dir}/lod${lod}.json`),receipt=build.receipts[lod];
  assert.equal(sha(receipt.bodySource),receipt.bodySha256,'Assembled source matches the production build');
  assert.equal(fit.components,1);assert.equal(fit.openEdges,0);assert.ok(fit.maxInfluences<=4);assert.equal(fit.zeroNormals,0);
  const tiers=[];
  for(const tier of receipt.tiers){
   assert.equal(sha(tier.path),tier.sha256);const bytes=readFileSync(tier.path),doc=await io.read(tier.path);
   const validation=validateDocument(doc,def,bytes.length,lod);assert.deepEqual(validation.errors,[],tier.path);
   assert.ok(bytes.length<=[600000,250000,150000][lod]);assert.ok(validation.triangles<=[6000,2500,4000][lod]);
   assert.ok(doc.getRoot().listSkins().length>0);assert.ok(doc.getRoot().listTextures().every(t=>t.getMimeType()==='image/ktx2'));
   tiers.push({...tier,triangles:validation.triangles,textures:doc.getRoot().listTextures().map(t=>({format:t.getMimeType(),size:t.getSize()}))});
  }
  lods.push({lod,components:fit.components,openEdges:fit.openEdges,maxInfluences:fit.maxInfluences,wraps:json(`${dir}/lod${lod}.wraps.json`),regions:json(`${dir}/lod${lod}.regions.json`),tiers});
 }
 builds.push({id,source:build.source,sourceContract:contract,sourceContractSha256:sha(join(build.source,'source/manifest.json')),eyes:existsSync(eyes)?{path:eyes,sha256:sha(eyes)}:undefined,manualSteps:build.manualSteps,pipelineViewer:viewer,lods});
}
writeFileSync(`${out}/build-integrity.json`,JSON.stringify({pass:true,sourcePipelineCommit:execFileSync('git',['-C',builds[0].source.split('/cast/')[0],'rev-parse','HEAD'],{encoding:'utf8'}).trim(),triangleCaps:[6000,2500,4000],appliedTriangleCaps:[6000,2500,2500],byteCaps:[600000,250000,150000],builds},null,2)+'\n');
console.log(JSON.stringify({identities:builds.length,deliveries:builds.length*6,pass:true}));
