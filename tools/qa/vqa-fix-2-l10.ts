/** Active native input on an actual physical-route save; distinct from the passive 240s hold. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { loadLevel } from '../sim-runner/levels';
import { followTenFrustum } from '../sim-runner/l10';
import { LevelTenBot } from '../../src/debug/bot/LevelTenBot';
import { cure } from '../../src/levels/L10/district';
import { observeAttackStarts } from './threat/attackStarts';
import { provenance } from './accept/probe';
const rows=[];
for(const tier of ['low','high'] as const){
 const save=JSON.parse(gunzipSync(execFileSync('git', ['show', `40f3d1de9:docs/reports/fix51-r10c/L10-${tier}-second-resume.json.gz`])).toString());
 const w=await loadLevel('L10',1,save,0,{quality:tier});
 try{
  w.missions!.loadResume(save.cureResume);w.combat!.damage.god=true;
  const bot=new LevelTenBot(w,'complete');
  // The ordinary bot starts its cursor at the crash. Rebase only that driver cursor for this late Resume.
  (bot as unknown as {waypoint:number}).waypoint=cure.regions.flatMap((r,i)=>i?r.route.slice(1):r.route).findIndex(at=>at[0]>=w.entities.get(1)!.transform.x);
  const m=w.missions!,samples:unknown[]=[],attacks:{tick:number;charge:number;source:number;target:number}[]=[];
  observeAttackStarts(w,(source,target)=>{if(m.state.states['charge-active'])attacks.push({tick:w.tick,charge:m.state.counters['charge-ticks'],source,target});});
  let activation:number|null=null,arrival:number|null=null,peak=0,maxMegaStep=0;
  const identities=new Set<number>(),relocations:unknown[]=[];
  const relocate=w.solids.relocate.bind(w.solids);
  w.solids.relocate=(entity,at,writer,range,navigation)=>{const from={...entity.transform};const moved=relocate(entity,at,writer,range,navigation);if(moved&&entity.infected?.pursuit)relocations.push({tick:w.tick,writer,metres:Math.hypot(entity.transform.x-from.x,entity.transform.z-from.z)});return moved;};
  for(let i=0;i<36000;i++){
   const before=w.megaPursuit!.entity(),from=before?{id:before.id,...before.transform}:null;
   followTenFrustum(w);w.applyInput(bot.sample(),'keyboard');w.update();
   const after=w.megaPursuit!.entity();if(after){identities.add(after.id);if(from&&from.id===after.id)maxMegaStep=Math.max(maxMegaStep,Math.hypot(after.transform.x-from.x,after.transform.z-from.z));}
   const charge=m.state.counters['charge-ticks'],mega=w.megaPursuit!.entity(),a=m.def.anchors['cure-console'];
   const d=mega?Math.hypot(mega.transform.x-a.x,mega.transform.z-a.z):null;
   if(m.state.states['charge-active']){
    activation??=w.tick;if(d!==null&&d<=25)arrival??=w.tick;
    const alive=w.infected!.active.filter(e=>e.health.current>0&&!e.pendingAdmission&&!e.infected!.hidden).length;peak=Math.max(peak,alive);
    if(w.tick%30===0)samples.push({tick:w.tick,charge,alive,player:{...w.entities.get(1)!.transform},mega:mega?{id:mega.id,...mega.transform,arenaDistance:d,mode:w.megaPursuit!.state.mode}:null});
   }
   if(charge>=3600||m.state.phase==='retry')break;
  }
  const result={tier,activation,arrival,maxMegaStep,identities:[...identities],relocations,arrivalSeconds:arrival!==null&&activation!==null?(arrival-activation)/60:null,charge:m.state.counters['charge-ticks'],finalPlayer:{...w.entities.get(1)!.transform},finalStep:m.def.steps.find(s=>m.state.steps[s.id].status==='active')?.id,peak,attacks:attacks.filter(a=>a.target===1),samples};rows.push(result);console.log(JSON.stringify({tier,activation,arrival:result.arrivalSeconds,charge:result.charge,peak,attacks:result.attacks.length}));
 }finally{w.dispose();}
}
writeFileSync(`docs/reports/vqa-fix-2/L10-active-native-${process.argv[2]??'trial'}.json`,JSON.stringify({...provenance(),method:'Exact previously exported physical research-to-complex Resume, then ordinary native complete-policy inputs through the full charge. Courier protection only. The native driver cursor is rebased to the next route waypoint for this Resume. No boss introduction, teleport, actor edits or passive hold.',rows},null,2)+'\n');

if((process.argv[2]??'').startsWith('verified'))for(const r of rows){assert.equal(r.charge,3600);assert(r.arrivalSeconds!==null&&r.arrivalSeconds<=60);assert(r.attacks.length>=8);assert.equal(r.identities.length,1);assert.equal(r.relocations.length,0);assert(r.maxMegaStep<=.4);for(let i=0;i<6;i++)assert(r.attacks.some(a=>a.charge>=i*600&&a.charge<(i+1)*600));}
