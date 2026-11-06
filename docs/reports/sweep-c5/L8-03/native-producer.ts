import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { emptyInput } from '../../../src/input/InputFrame';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance } from './probe';
import { atomicJson } from './report';
const rows = [];
for (const tier of ['low','high'] as const) {
 const campaign = preset('L8-default'); campaign.settings.quality = tier;
 for (const mode of ['natural','outside'] as const) {
  const w = await loadLevel('L8',1,structuredClone(campaign),0,{quality:tier});
  try {
   const original = [...w.entities.iterate()].filter(e=>e.civilian).map(e=>({id:e.id,archetype:e.archetype,species:e.civilian!.zooAnimal??null,role:e.civilian!.ally?.role??null,carried:w.missions!.l8!.state.roster.includes(e.id),hp:e.health.current}));
   const fixture = mode==='outside' ? [{x:0,z:-89,to:{x:0,z:-82}},{x:0,z:89,to:{x:0,z:82}},{x:-119,z:0,to:{x:-112,z:0}},{x:119,z:0,to:{x:112,z:0}}].map(at=>{
    const id=w.infected!.spawn('infected.runner',at,{state:'chase'}),e=w.entities.get(id)!; e.infected!.scripted={...at.to};
    return {id,at,before:{...e.transform}};
   }) : [];
   const idle = new Map<number,{ticks:number;maximum:number;last:{x:number;z:number};facingTicks:number;movingTicks:number;purposeTicks:number;hostileTicks:number}>();
   const samples: object[] = [],hits: object[] = [];let crossed=0,missing=0,dead=0;
   w.events.on('combat.hit',e=>{if(e.type==='combat.hit'&&fixture.some(f=>f.id===e.sourceId))hits.push({...e});});
   for(let i=0;i<3599;i++) {
    w.applyInput(emptyInput(),'keyboard');w.update();
    for(const seed of original) {
     const e=w.entities.get(seed.id)!;if(!e?.civilian||e.hidden||e.health.current<=0)continue;
     const c=e.civilian,step=c.schedule?.[c.scheduleStep??0],r=idle.get(e.id)??{ticks:0,maximum:0,last:{...e.transform},facingTicks:0,movingTicks:0,purposeTicks:0,hostileTicks:0};
     const moved=Math.hypot(e.transform.x-r.last.x,e.transform.z-r.last.z)>.0001;
     const facing=!!step?.facing;
     const purpose=!!c.survivor||!!c.ally||!!c.activityUntil&&step?.activity!=='walk';
     r.ticks=!moved&&!facing&&!purpose?r.ticks+1:0;r.maximum=Math.max(r.maximum,r.ticks);r.movingTicks+=Number(moved);r.facingTicks+=Number(facing);r.purposeTicks+=Number(purpose);r.hostileTicks+=Number(!!e.infected||e.faction==='infected');r.last={...e.transform};idle.set(e.id,r);
    }
    for(const f of fixture){const e=w.entities.get(f.id);if(!e||e.hidden||e.pendingAdmission)missing++;else if(e.health.current<=0)dead++;else if(Math.abs(e.transform.x)<115.6&&Math.abs(e.transform.z)<85.6)crossed++;}
    if(w.tick%60===0||w.tick===3599)samples.push({tick:w.tick,fixture:fixture.map(f=>{const e=w.entities.get(f.id);return{id:f.id,hp:e?.health.current,hidden:e?.hidden,pending:e?.pendingAdmission,position:e?{...e.transform}:null};}),locals:original.map(s=>{const e=w.entities.get(s.id)!;return{id:s.id,position:{...e.transform},state:e.civilian?.state,activity:e.civilian?.schedule?.[e.civilian?.scheduleStep??0],activityUntil:e.civilian?.activityUntil};})});
   }
   const finalHash=stateHash(w.getState());let controlHash:string|null=null;
   if(mode==='natural'){const control=await loadLevel('L8',1,structuredClone(campaign),0,{quality:tier});try{for(let i=0;i<3599;i++){control.applyInput(emptyInput(),'keyboard');control.update();}controlHash=stateHash(control.getState());assert.equal(finalHash,controlHash);}finally{control.dispose();}}
   rows.push({tier,mode,original,fixture,activity:[...idle].map(([id,r])=>({id,...r,maximumIdleFacingNowhereSeconds:r.maximum/60})),samples,hits,crossed,missing,dead,finalHash,controlHash});
   console.log(tier,mode,{crossed,missing,dead,hits:hits.length,maxIdle:Math.max(...[...idle.values()].map(r=>r.maximum/60))});
  }finally{w.dispose();}
 }
}
atomicJson('docs/reports/sweep-c5/L8-03/native.json',{...provenance(),toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'3599 ordinary fixed ticks before breach. Natural passive input observer equals independently unobserved control. Explicit separate four production regular runners spawned outside cardinal walls with ordinary scripted walk targets inside; no HP/AI/faction/physics changes thereafter. Records every outside runner each tick, damages, visibility/admission/death, plus activity intent. Idle-facing-nowhere classifier is diagnostic only until paired with actual rendered clips/frames; a look target, ally/survivor duty or explicit scheduled activity counts as purpose, not translation.',rows});
