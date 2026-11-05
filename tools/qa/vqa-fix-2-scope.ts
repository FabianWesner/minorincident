/** Process-local causal comparison; never an acceptance receipt. */
import { writeFileSync,readFileSync } from 'node:fs';
import { Companion } from '../../src/sim/npc/Companion';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { ThreatObserver } from './threat/observer';
import { probeLevel,provenance } from './accept/probe';
import { runFixtures } from './accept/fixtures';
import { evaluate } from './accept/evaluate';
const before=JSON.parse(readFileSync('test-results/qa-threat/L3.json','utf8'));
const proto=Companion.prototype as unknown as {clearRestingSpot:()=>boolean};
const old=proto.clearRestingSpot;proto.clearRestingSpot=()=>false;
try{
 let observer:ThreatObserver|undefined,observation:ReturnType<ThreatObserver['finish']>|undefined;
 const run=await runLevel('L3','complete',1,70,'auto',preset('L3-default'),undefined,0,{quality:'low',passive:true,beforeBegin:w=>{observer=new ThreatObserver(w,'L3');},beforeDispose:()=>{observation=observer!.finish();}});
 const high=await probeLevel('L2','high','complete');
 const fixtures=await runFixtures('L2','low',provenance().sourceHash,'diagnostic-only');
 const result={...provenance(),method:'Only the new idle resting helper is disabled process-locally, leaving floor placement and all other production rules unchanged. No canonical receipts are overwritten.',before:{run:before.passiveRun,squad:before.passiveObservation.l3Squad},after:{run,observation},L2High:evaluate(high,'diagnostic-only').filter(x=>x.id==='L2-07'),L2Low:fixtures.checks.filter(x=>x.id==='L2-11')};
 writeFileSync('docs/reports/vqa-fix-2/companion-scope-comparison.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({beforeSquad:result.before.squad,afterSquad:observation?.l3Squad,L2High:result.L2High.map(x=>({clause:x.clause,status:x.status,value:x.value})),L2Low:result.L2Low.map(x=>({clause:x.clause,status:x.status,value:x.value}))}));
}finally{proto.clearRestingSpot=old;}
