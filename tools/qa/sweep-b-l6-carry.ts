/** Inspect L6 from the actual current physical L5 campaign saves, not a preset. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { CampaignSave } from '../../src/sim/progression/Campaign';
import { SAVE_KEY, validateSave } from '../../src/sim/progression/Save';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';
import { provenance } from './accept/probe';
const out='test-results/sweep-b/L6-carry';mkdirSync(`${out}/captures`,{recursive:true});const rows=[];
try{
 for(const tier of ['low','high'] as const){
  const source=`test-results/vqa-1b/sweep-b-L5-${tier}-z1.5/profile/pool-storage.json`;
  const storage=JSON.parse(readFileSync(source,'utf8')) as {origins:{localStorage:{name:string;value:string}[]}[]};
  const save=JSON.parse(storage.origins.flatMap(o=>o.localStorage).find(v=>v.name===SAVE_KEY)!.value) as CampaignSave;
  assert(validateSave(save));assert.equal(save.completedLevels,5);assert.equal(save.stationOccupants!.length,24);assert.equal(save.settings.quality,tier);
  writeFileSync(`${out}/${tier}-actual-L5-save.json`,JSON.stringify(save));
  const session=new SceneSession({tier,backend:'webgl2',query:{profile:'0',ui:'1'}});
  try{
   await session.open();
   await session.page.evaluate(async({save,tier})=>{
    const a=window.__SS__!;a.settings.set({quality:tier});a.campaign.restore(save);await a.loadLevel('L6',{seed:1});a.pause();a.missions.begin();a.cheats.god(false);a.camera.follow();a.camera.zoom(1.5);
    document.documentElement.setAttribute('data-scene-hud','');for(const style of document.querySelectorAll('style'))if(style.textContent?.includes('#hud:not([data-scene-hud])'))style.remove();
   },{save,tier});
   const samples=[];
   for(let second=0;second<5;second++){
    if(second)await session.page.evaluate(async()=>{await window.__SS__!.step(60);});
    samples.push(await session.page.evaluate(()=>{
     const g=(window.__SCENE__ as unknown as{game:Game}).game,w=g.world,s=w.missions!.state.l6!;
     return {tick:w.tick,tier:w.infected!.director.tier,renderTier:g.view.getState().quality,roster:s.survivors.map(r=>{const e=w.entities.get(r.id)!;return{id:r.id,key:r.key,routine:r.routine,injured:r.injured,status:r.status,at:{...e.transform},hp:e.health,story:e.civilian!.story,activity:e.civilian!.schedule?.[e.civilian!.scheduleStep!]?.activity,handProp:e.appearance?.handProp};})};
    }));
   }
   const files=[];
   for(const camera of ['opening','overview']){
    if(camera==='overview')await session.page.evaluate(async()=>{const a=window.__SS__!;a.camera.cinematic({position:[20,24,35],target:[0,.6,12]},true);await a.step(0);});
    await session.ready();const file=`${out}/captures/${tier}-${camera}.jpg`;await session.page.screenshot({path:file,type:'jpeg',quality:90});files.push(file);
   }
   const ids=save.stationOccupants!.map(e=>e.id);assert.deepEqual(samples[0].roster.map(e=>e.id).sort((a,b)=>a-b),ids.sort((a,b)=>a-b));
   rows.push({tier,sourceSave:`${out}/${tier}-actual-L5-save.json`,sourceSaveSha256:createHash('sha256').update(readFileSync(`${out}/${tier}-actual-L5-save.json`)).digest('hex'),carriedResidentIds:ids,samples,files,errors:session.errors});console.log(tier,samples[0].roster.map(e=>e.story?.clip));
  }finally{await session.close();}
 }
}finally{stopServer();writeFileSync(`${out}/proof.json`,JSON.stringify({...provenance(),producerSha256:createHash('sha256').update(readFileSync('tools/qa/sweep-b-l6-carry.ts')).digest('hex'),method:'Actual completed current-source physical L5 low/high save from the own isolated campaign localStorage, not L6-default. Production L6 load and four ordinary idle seconds; no objective advance or actor writes. Identity/full-HP/routine/posture census at1Hz, ordinary opening camera and an explicit overview photo; no performance timing. The low L5 observer threw at handover, but the production save already committed completedLevels5 and its24 actual station residents.',rows},null,2)+'\n');}
