/** Read-only opening-pressure receipt for the ordinary mortal L6 controller. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { ThreatObserver } from './threat/observer';
import { provenance } from './accept/probe';
const rows=[];
for(const tier of ['low','high'] as const){
 let observer:ThreatObserver|undefined,observation:ReturnType<ThreatObserver['finish']>|undefined;
 const campaign=preset('L6-default');campaign.settings.quality=tier;
 const run=await runLevel('L6','complete',1,80,'auto',campaign,undefined,0,{quality:tier,beforeBegin:w=>{observer=new ThreatObserver(w,'L6');},beforeDispose:()=>{observation=observer?.finish();}});
 const row={tier,run,opening:observation?.phases.find(p=>p.key==='step/stop'),observation};rows.push(row);
 console.log(JSON.stringify({tier,opening:row.opening}));
}
mkdirSync('test-results/fix71-b2',{recursive:true});writeFileSync('test-results/fix71-b2/opening.json',JSON.stringify({...provenance(),rows},null,2)+'\n');
