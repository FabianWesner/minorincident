import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { survivor } from '../../../src/data/survivor';
import { stateHash } from '../../../src/sim/world/stateHash';
import { provenance } from './probe';
import { atomicJson } from './report';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L10-default');campaign.settings.quality=tier;
 const ids=new Set<number>(),samples:object[]=[],cues:object[]=[],cruise:number[]=[],blind:number[]=[],relocations:object[]=[];
 let previous:{id:number;x:number;z:number}|undefined,maxStep=0,longestStall=0,stall=0,finalHash='',aliveTicks=0;
 const run=await runLevel('L10','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:world=>{
  world.events.on('mega.cue',event=>{if(event.type==='mega.cue'){const e=world.entities.get(event.sourceId),p=world.entities.get(1)!;cues.push({...event,distance:e?Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z):null});}});
  const relocate=world.solids.relocate.bind(world.solids);world.solids.relocate=(entity,at,writer,range,navigation)=>{const from={...entity.transform},moved=relocate(entity,at,writer,range,navigation);if(moved&&entity.infected?.pursuit)relocations.push({tick:world.tick,writer,metres:Math.hypot(entity.transform.x-from.x,entity.transform.z-from.z)});return moved;};
  const update=world.update.bind(world);world.update=()=>{update();const pursuit=world.megaPursuit,e=pursuit?.entity();if(!pursuit||!e||e.health.current<=0){previous=undefined;return;}ids.add(e.id);aliveTicks++;
   const p=world.entities.get(1)!,distance=Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z),step=previous?.id===e.id?Math.hypot(e.transform.x-previous.x,e.transform.z-previous.z):0;
   if(previous){maxStep=Math.max(maxStep,step);stall=distance>20&&step<.0001?stall+1:0;longestStall=Math.max(longestStall,stall);}
   if(world.tick%30===0&&previous){const speed=step*60,los=world.combat!.query.visible(e.transform,p.transform,p.id),inCruiseBand=pursuit.inCruiseBand(e,p);if(distance>20&&speed>.1&&inCruiseBand&&!e.infected!.specialAttack){cruise.push(speed/survivor.speed);if(!los)blind.push(speed);}
    samples.push({tick:world.tick,id:e.id,mode:pursuit.state.mode,distance,speed,runRatio:speed/survivor.speed,los,inCruiseBand,configuredSpeed:e.infected!.speed});}
   previous={id:e.id,x:e.transform.x,z:e.transform.z};};
 },beforeDispose:world=>{finalHash=stateHash(world.getState());}});
 assert(run.completed);
 const control=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`,'utf8')) as {sourceHash:string;observerHash:string;nativeStateHash:string};
 const controlIdentical=control.sourceHash===identity.sourceHash&&control.observerHash===identity.observerHash&&control.nativeStateHash===finalHash;
 assert(controlIdentical,'Read-only pursuit observation must match the current canonical native receipt');
 cruise.sort((a,b)=>a-b);rows.push({tier,run,controlIdentical,nativeStateHash:finalHash,persistentIds:[...ids],aliveTicks,maxStepMetres:maxStep,longestFarStallSeconds:longestStall/60,cruiseMedianRunRatio:cruise[Math.floor(cruise.length/2)]??null,cruiseSamples:cruise.length,movingWithoutLosSamples:blind.length,relocations,cues,samples});
 console.log(tier,rows.at(-1));
}
atomicJson('docs/reports/fix56-c/L10-pursuit.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Both exact canonical competent routes; every-tick body displacement/identity and all production cue/relocation events;30tick distance/speed/LOS samples. Cruise ratio is qualified only when the same production on-camera-or-within-200m predicate is true. No input/actor/RNG writes. Does not qualify rendered minimap or actual sound gain.',rows});
