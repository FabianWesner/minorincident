/** Read-only ordinary L6 complete route: distinguish empty-input waiting from combat. */
import { readFileSync, writeFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { provenance } from './probe.ts';
const result={...provenance(),method:'Canonical complete driver. Read-only applyInput/update wrappers preserve every input and world update. Human following roster only; wait requires an empty movement/attack/interact frame, resolved player speed<=0.2m/s, and a live follower>10m. Story locks and nonplaying phases excluded. Canonical final state comparison.',rows:[]};
for(const tier of ['low','high']){
 const campaign=preset('L6-default');campaign.settings.quality=tier;
 let escortTicks=0,waitTicks=0,soleWaitTicks=0,frame=null,hash;const spans=[];
 const run=await runLevel('L6','complete',1,undefined,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{
  const apply=w.applyInput.bind(w),update=w.update.bind(w);
  w.applyInput=(input,source)=>{frame=input;return apply(input,source)};
  w.update=()=>{const p=w.entities.get(1),before={x:p.transform.x,z:p.transform.z};const r=update();
   if(w.storyLock||w.missions.state.phase!=='playing'||!frame)return r;
   const group=w.missions.state.l6.survivors.filter(s=>s.status==='following').map(s=>w.entities.get(s.id)).filter(e=>e&&e.health.current>0&&!e.hidden&&!e.infected&&!e.infection&&!['grabbed','bitten','down','rising','flee'].includes(e.civilian?.state));
   if(!group.length)return r;escortTicks++;
   const far=group.filter(e=>Math.hypot(e.transform.x-p.transform.x,e.transform.z-p.transform.z)>10);
   const empty=Math.hypot(frame.move.x,frame.move.z)===0&&!frame.interact&&!frame.mouseAttack&&!frame.activeAttack&&!frame.left?.held&&!frame.left?.down&&!frame.right?.held&&!frame.right?.down;
   const speed=Math.hypot(p.transform.x-before.x,p.transform.z-before.z)*60;
   if(empty&&speed<=.2&&far.length){waitTicks++;if(far.length===1)soleWaitTicks++;const last=spans.at(-1);if(last&&last.end===w.tick-1)last.end=w.tick;else spans.push({start:w.tick,end:w.tick,phase:w.missions.state.l6.phase,far:far.map(e=>e.id)});}
   return r;
  };
 },beforeDispose:w=>{hash=stateHash(w.getState())}});
 const canonical=JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L6-${tier}-complete.json`));
 result.rows.push({tier,completed:run.completed,escortTicks,waitTicks,soleWaitTicks,waitPercent:100*waitTicks/escortTicks,soleWaitPercent:100*soleWaitTicks/escortTicks,spans,hash,controlHash:canonical.nativeStateHash,identical:hash===canonical.nativeStateHash});
 console.log(result.rows.at(-1));
}
writeFileSync('docs/reports/final-g/G-13-L6-wait.json',JSON.stringify(result,null,2)+'\n');
process.exitCode=result.rows.every(r=>r.identical)?0:1;
