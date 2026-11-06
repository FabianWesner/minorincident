import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { l7Encounters } from '../../../src/data/l7';
import { provenance,type NativeReceipt } from './probe';
import { atomicJson } from './report';
const identity=provenance(),rows=[];
for(const tier of ['low','high'] as const){
 const campaign=preset('L7-default');campaign.settings.quality=tier;
 let initial:object[]|undefined,finalHash='';const blasts:{tick:number;x:number;z:number;killed:number[]}[]=[],crossings:object[]=[],seen=new Set<number>(),cohort=new Set<number>();
 const run=await runLevel('L7','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:world=>{
  world.events.on('explosion',event=>{if(event.type==='explosion'&&event.sourceId===1&&event.position.x<0)blasts.push({tick:event.tick,x:event.position.x,z:event.position.z,killed:[...cohort].filter(id=>(world.entities.get(id)?.health.current??0)<=0)});});
  const update=world.update.bind(world);world.update=()=>{
   if(!initial){const actors=world.infected!.active.filter(e=>e.infected!.pack===l7Encounters.finalGroup);if(actors.length){initial=actors.map(e=>({id:e.id,archetype:e.archetype,hp:e.health.current,hidden:e.hidden,pending:e.pendingAdmission,position:{...e.transform}}));for(const e of actors)cohort.add(e.id);}}
   update();for(const entry of world.l7Encounters!.state.roster){const e=world.entities.get(entry.id);if(!e||seen.has(e.id)||e.hidden||e.health.current<=0||e.infected||e.transform.x>=-68||Math.abs(e.transform.z-47)>9)continue;const nearby=blasts.filter(blast=>world.tick>=blast.tick&&Math.hypot(e.transform.x-blast.x,e.transform.z-blast.z)<=6);if(!nearby.length)continue;seen.add(e.id);crossings.push({tick:world.tick,id:e.id,hp:e.health.current,position:{...e.transform},nearbyRocketBlasts:nearby.map(b=>b.tick),nearestLivingFinalActor:Math.min(...[...cohort].flatMap(id=>{const actor=world.entities.get(id);return actor&&actor.health.current>0&&!actor.hidden?[Math.hypot(actor.transform.x-e.transform.x,actor.transform.z-e.transform.z)]:[];}))});}
  };
 },beforeDispose:world=>{finalHash=stateHash(world.getState());}});
 const control=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L7-${tier}-complete.json`,'utf8')) as NativeReceipt;assert(run.completed);assert.equal(control.sourceHash,identity.sourceHash);assert.equal(finalHash,control.nativeStateHash);
 rows.push({tier,initial,blasts,crossings,run,controlIdentical:true,nativeStateHash:finalHash});console.log(tier,initial?.length,blasts.length,crossings.length);
}
atomicJson('docs/reports/fix55-c/L7-corridor.json',{...identity,toolSha256:createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),method:'Read-only both canonical competent routes; exact initial final-group actors before first update, real rocket blast events and living unboarded human positions across x=-68 within a prior rocket blast radius. Explicit geometric crossing, not the unused passed flag at x=-76 beyond the bus door. Final state equals independent control. Native physical simulation, not a browser or full blocked-cross-section proof.',rows});
